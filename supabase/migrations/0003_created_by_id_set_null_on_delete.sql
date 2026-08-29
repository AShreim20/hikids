-- created_by_id -> auth.users(id) had no ON DELETE behavior (default RESTRICT),
-- so deleting a user (deleteAccount) failed with "Database error deleting
-- user" the moment that user had created any row anywhere. Preserve the row
-- (audit/order/etc. history shouldn't vanish) but detach it from the deleted
-- account.
do $$
declare
  r record;
begin
  for r in
    select tc.table_name, tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'created_by_id' and tc.table_schema = 'public'
  loop
    execute format('alter table public.%I drop constraint %I;', r.table_name, r.constraint_name);
    execute format(
      'alter table public.%I add constraint %I foreign key (created_by_id) references auth.users(id) on delete set null;',
      r.table_name, r.constraint_name
    );
  end loop;
end;
$$;
