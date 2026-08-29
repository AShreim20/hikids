-- profiles uses `updated_at` (idiomatic naming, since it isn't a Base44
-- entity) while every other table uses `updated_date`. Its trigger was wired
-- to the generic set_updated_date() function, which references
-- new.updated_date -- a column profiles doesn't have. Any UPDATE to profiles
-- (role/permission changes, full_name save) crashed with:
--   record "new" has no field "updated_date"
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
