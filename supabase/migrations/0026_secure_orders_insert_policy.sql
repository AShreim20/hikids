-- CRITICAL security fix (pre-launch audit): the public order-insert policy
-- let a client pre-set trusted server-verification flags on its own order.
--
-- Root cause: orders_insert_public was `with check (true)` — every column
-- was writable at INSERT with no restriction, including `secured`,
-- `stock_committed`, `payment_status`, `discount_counted`, and the loyalty
-- ledger flags. secure_order()/commit_order_stock() both short-circuit
-- ("already secured"/"already committed") the moment those flags are true,
-- so a client that inserted a "pre-verified" order bypassed both RPCs
-- entirely. Live-reproduced during this fix: an anonymous (guest) INSERT
-- created an order with secured=true, stock_committed=true,
-- payment_status='paid', discount_counted=true and an attacker-chosen
-- total of 0.01, with neither authoritative RPC ever running.
--
-- Fix: narrow the INSERT check to only allow the "safe, unverified" initial
-- state every legitimate order actually starts in (confirmed against the
-- one real call site, src/pages/Checkout.jsx's db.Order.create — it never
-- sets any of these flags to a "verified" value at insert time):
--   - secured / stock_committed / discount_counted / loyalty_awarded /
--     loyalty_reversed / loyalty_released must all start false (their
--     column defaults) so both RPCs always actually run.
--   - status must start 'new'.
--   - payment_status must start 'unpaid', with one narrow, already-live
--     exception: an authenticated customer paying with their own loyalty
--     balance (payment_method = 'loyalty') may insert payment_status =
--     'paid', matching current checkout behavior — the real balance
--     deduction for that path already happens through the loyalty RPCs
--     (redeem_loyalty_points, real, balance-checked, ledger-recorded)
--     BEFORE this insert runs. This exception requires created_by_id to
--     already equal the caller (auth.uid()), which also closes the door on
--     spoofing someone else's order as paid. Every other combination
--     (guest, cod, card) can never insert payment_status = 'paid'.
drop policy if exists "orders_insert_public" on public.orders;

create policy "orders_insert_public" on public.orders
  for insert
  with check (
    secured = false
    and stock_committed = false
    and discount_counted = false
    and loyalty_awarded = false
    and loyalty_reversed = false
    and loyalty_released = false
    and status = 'new'
    and (
      payment_status = 'unpaid'
      or (
        payment_status = 'paid'
        and payment_method = 'loyalty'
        and auth.uid() is not null
        and created_by_id = auth.uid()
      )
    )
  );
