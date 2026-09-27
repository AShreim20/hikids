-- Keeps public.profiles.email in sync with auth.users.email.
--
-- Needed for the Account page's new email-change flow: the frontend only
-- ever calls supabase.auth.updateUser({ email }) (Supabase's own confirmed
-- double opt-in flow — auth.users.email itself does not change until the
-- customer clicks the confirmation link), never writes auth.users directly.
-- Without this, profiles.email — used server-side for loyalty/wallet
-- lookups, audit logs, discount code ownership, etc. — would silently go
-- stale after a confirmed email change.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
