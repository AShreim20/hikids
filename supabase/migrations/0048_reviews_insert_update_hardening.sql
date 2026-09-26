-- P1 security: close the direct-REST bypass on public.reviews.
--
-- Before: reviews_insert_public was `with check (true)` for role public (anon
-- included), so anyone could POST a review with status='approved', an arbitrary
-- photo_url and someone else's created_by_id/user_email. The UPDATE policy also
-- let a review's owner rewrite status/photo_url on their own row.
--
-- After (enforced in the database, independent of the UI):
--   * INSERT by anon/authenticated: status must be 'pending', no photo_url,
--     reward_granted false, no reviewed_by/review_note, and any identity field
--     (created_by_id, user_id, user_email) must equal the caller's own JWT
--     identity (or be null for guests). Violations fail with an RLS error.
--     Photo reviews only enter via the submitPhotoReview Edge Function
--     (service role, bypasses RLS) which keeps forcing status='pending'.
--   * A BEFORE INSERT trigger fills user_id/user_email from the JWT for signed-in
--     customers so identity is never client-supplied.
--   * UPDATE by anon/authenticated non-admins can no longer change moderation or
--     identity columns (status, photo_url, reward_granted, reviewed_by,
--     review_note, created_by_id, user_id, user_email, product_id).
--   * Admins (is_admin()) and the service role (reviewPhoto Edge Function) are
--     unaffected. SELECT policy and existing rows are untouched.

drop policy if exists reviews_insert_public on public.reviews;
create policy reviews_insert_public on public.reviews
  for insert to public
  with check (
    is_admin()
    or (
      status = 'pending'
      and photo_url is null
      and reward_granted = false
      and reviewed_by is null
      and review_note is null
      and (created_by_id is null or created_by_id = auth.uid())
      and (user_id is null or user_id = auth.uid())
      and (user_email is null or user_email = (auth.jwt() ->> 'email'))
    )
  );

create or replace function public.reviews_fill_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and auth.uid() is not null and not is_admin() then
    if new.user_id is null then new.user_id := auth.uid(); end if;
    if new.user_email is null then new.user_email := auth.jwt() ->> 'email'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_fill_identity on public.reviews;
create trigger reviews_fill_identity
  before insert on public.reviews
  for each row execute function public.reviews_fill_identity();

create or replace function public.reviews_guard_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and not is_admin() then
    if new.status is distinct from old.status
       or new.photo_url is distinct from old.photo_url
       or new.reward_granted is distinct from old.reward_granted
       or new.reviewed_by is distinct from old.reviewed_by
       or new.review_note is distinct from old.review_note
       or new.created_by_id is distinct from old.created_by_id
       or new.user_id is distinct from old.user_id
       or new.user_email is distinct from old.user_email
       or new.product_id is distinct from old.product_id then
      raise exception 'Reviews: moderation and identity fields cannot be modified'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_guard_update on public.reviews;
create trigger reviews_guard_update
  before update on public.reviews
  for each row execute function public.reviews_guard_update();
