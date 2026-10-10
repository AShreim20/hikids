-- Admin e-mail notifications (new order, cancelled order, new return/exchange request,
-- new photo review, new challenge photo).
--
-- Flow:  row change  ->  AFTER trigger  ->  public._notify_admin()  ->  pg_net HTTP POST
--        ->  Edge Function `notifyAdmin`  ->  Resend API  ->  admin inbox.
--
-- Security model:
--  * The Edge Function is public (verify_jwt = false) so Postgres can call it, but it only acts when the
--    request carries the shared secret stored in Supabase Vault; it re-reads the row itself, so nothing in
--    the request body is trusted for content.
--  * The secret is readable only through public.get_admin_notify_secret(), executable by service_role only.
--  * A notification failure must NEVER block an order or a customer action, so every call is wrapped in
--    an exception handler and pg_net is asynchronous (fires after commit).

create extension if not exists pg_net with schema extensions;

-- 1) shared secret (created once, random)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'admin_notify_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'admin_notify_secret',
      'Shared secret between the DB notification triggers and the notifyAdmin Edge Function'
    );
  end if;
end $$;

create or replace function public.get_admin_notify_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'admin_notify_secret' limit 1;
$$;
revoke all on function public.get_admin_notify_secret() from public, anon, authenticated;
grant execute on function public.get_admin_notify_secret() to service_role;

-- 2) dispatcher
create or replace function public._notify_admin(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'admin_notify_secret' limit 1;
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://fcituvmbtqxpjgbyzpbf.supabase.co/functions/v1/notifyAdmin',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('kind', p_kind, 'id', p_id),
    timeout_milliseconds := 8000
  );
exception when others then
  -- never let a notification problem break the business transaction
  raise warning 'admin notification (%) failed: %', p_kind, sqlerrm;
end;
$$;
revoke all on function public._notify_admin(text, uuid) from public, anon, authenticated;

-- 3) trigger functions
create or replace function public.trg_notify_order_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- a brand-new order becomes "real" when secure_order() verifies the totals
    if coalesce(old.secured, false) = false and coalesce(new.secured, false) = true then
      perform public._notify_admin('new_order', new.id);
    elsif old.status is distinct from new.status and new.status = 'cancelled' then
      perform public._notify_admin('order_cancelled', new.id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.trg_notify_order_changes() from public, anon, authenticated;

create or replace function public.trg_notify_new_return_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._notify_admin('new_return_request', new.id);
  return new;
end;
$$;
revoke all on function public.trg_notify_new_return_request() from public, anon, authenticated;

create or replace function public.trg_notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform public._notify_admin('new_review', new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.trg_notify_new_review() from public, anon, authenticated;

create or replace function public.trg_notify_new_challenge_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform public._notify_admin('new_challenge_submission', new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.trg_notify_new_challenge_submission() from public, anon, authenticated;

-- 4) triggers
drop trigger if exists orders_notify_admin on public.orders;
create trigger orders_notify_admin
  after update on public.orders
  for each row execute function public.trg_notify_order_changes();

drop trigger if exists return_requests_notify_admin on public.return_requests;
create trigger return_requests_notify_admin
  after insert on public.return_requests
  for each row execute function public.trg_notify_new_return_request();

drop trigger if exists reviews_notify_admin on public.reviews;
create trigger reviews_notify_admin
  after insert on public.reviews
  for each row execute function public.trg_notify_new_review();

drop trigger if exists challenge_submissions_notify_admin on public.challenge_submissions;
create trigger challenge_submissions_notify_admin
  after insert on public.challenge_submissions
  for each row execute function public.trg_notify_new_challenge_submission();
