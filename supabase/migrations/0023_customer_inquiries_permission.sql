-- Pre-launch review, PART 4: Customer Inquiries admin access was gated on
-- plain is_admin(), while every other place that shows this same category
-- of customer data (name/phone/email) -- OrderDetail.jsx -- already uses
-- the finer-grained `customers.manage` permission via has_permission().
-- Align this table with that existing convention (same pattern already
-- used for expenses_read/expenses_write on the `expenses` table).
--
-- has_permission(perm) already returns true for role='admin' regardless of
-- their `permissions` array (see its definition in 0001_init.sql), so the
-- owner keeps access automatically; a staff account only gains access once
-- explicitly granted 'customers.manage' via StaffManagement.jsx, same as
-- every other permission-gated area.
--
-- This does not touch customer_inquiries_insert_public (the FAQ page's
-- guest/customer submission policy) at all -- submission and admin-reading
-- are different concerns, and the public can still submit exactly as
-- before.

drop policy if exists "customer_inquiries_admin_select" on public.customer_inquiries;
drop policy if exists "customer_inquiries_admin_update" on public.customer_inquiries;

create policy "customer_inquiries_read" on public.customer_inquiries
  for select using (public.has_permission('customers.manage'));

create policy "customer_inquiries_write" on public.customer_inquiries
  for update using (public.has_permission('customers.manage'))
  with check (public.has_permission('customers.manage'));
