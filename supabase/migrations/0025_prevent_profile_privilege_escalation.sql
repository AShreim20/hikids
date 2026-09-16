-- CRITICAL security fix (pre-launch audit): a signed-in customer could
-- self-promote to admin.
--
-- Root cause: profiles_update_own_or_admin's WITH CHECK only verifies the
-- row being written belongs to the caller (id = auth.uid()) — it never
-- restricts which COLUMNS a non-admin may change. Since `role` and
-- `permissions` are ordinary columns on the same row, any authenticated
-- customer could run, from the browser console:
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', <own id>)
-- Live-reproduced during this fix: a disposable non-admin test profile
-- successfully set its own role to 'admin' and permissions to a non-empty
-- array using exactly this call shape.
--
-- Blast radius: is_admin()/has_permission() (and therefore every RLS policy
-- and RPC guard in the app) key off this exact column, so this one gap
-- defeated every other authorization check in the system.
--
-- Fix: a BEFORE UPDATE trigger that pins `role`/`permissions` back to their
-- prior (OLD) values whenever the acting session is not currently an admin
-- — enforced at the row-write boundary itself, independent of and in
-- addition to the existing RLS policy, so it can't be bypassed by any
-- future RLS change. is_admin() inside the trigger evaluates against the
-- pre-update snapshot (the current UPDATE statement hasn't committed the
-- new row yet), so:
--   - a non-admin editing their own row: is_admin() is false -> role/
--     permissions are silently kept at their previous values; every other
--     column (name, phone, etc.) still updates normally.
--   - an admin editing anyone's row (including the existing Staff
--     Management "change a user's role/permissions" flow): is_admin()
--     checks the ACTING admin's own (unaffected) row and is true -> the
--     new role/permissions pass through unchanged, exactly as today.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.permissions := old.permissions;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();
