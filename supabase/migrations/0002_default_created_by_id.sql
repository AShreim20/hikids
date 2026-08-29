-- Every table's created_by_id defaults to the caller's auth.uid() on insert,
-- mirroring Base44's transparent behavior. Without this, an INSERT that
-- doesn't explicitly set created_by_id fails owner-scoped RLS checks (e.g.
-- addresses_insert_own: with check (created_by_id = auth.uid())).
create or replace function public.set_created_by_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by_id is null then
    new.created_by_id = auth.uid();
  end if;
  return new;
end;
$$;

revoke execute on function public.set_created_by_id() from public, anon, authenticated;

do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'created_by_id'
  loop
    execute format(
      'create trigger %I_set_created_by_id before insert on public.%I for each row execute function public.set_created_by_id();',
      t, t
    );
  end loop;
end;
$$;
