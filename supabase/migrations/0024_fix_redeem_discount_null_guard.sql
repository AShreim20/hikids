-- Pre-launch QA audit finding: redeem_discount() could increment a discount
-- code's used_count even when secure_order() had already invalidated that
-- code on the order (expired/exhausted/inactive/min-subtotal-not-met —
-- secure_order clears order.discount_code to null in every one of those
-- cases; see 0021_guest_checkout_stock_fix.sql lines ~150-166).
--
-- Root cause: the old guard `v_order.discount_code is not null and
-- v_order.discount_code <> v_dc.code` only rejects a NON-null mismatch. A
-- null discount_code (exactly the invalidated case) makes the first half of
-- that AND false, so the whole guard is skipped and execution falls through
-- to the used_count increment below — a real code was never applied to the
-- order, yet its usage counter still went up.
--
-- Live-reproduced during the QA audit: a code with usage_limit=1,
-- used_count=1 (already exhausted) attached to a fresh guest order;
-- secure_order() correctly zeroed the discount and cleared discount_code to
-- null; redeem_discount() still bumped used_count to 2.
--
-- Fix: replace the two-part null-tolerant condition with a single null-safe
-- equality check. `is distinct from` treats null as never equal to
-- anything, so it correctly rejects both the null case and a real mismatch
-- in one expression, and continues to pass through unchanged when the
-- order's discount_code genuinely matches the code being redeemed — the
-- only change in this migration is this one guard line; everything else
-- (ownership checks, the wheel-spin linkage, and — critically — the
-- pre-existing `discount_counted` idempotency guard a few lines below,
-- which already prevents a retry/duplicate finalization call from
-- incrementing used_count twice) is byte-identical to the previous version.
create or replace function public.redeem_discount(p_code_id uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_dc public.discount_codes;
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_is_owner boolean;
  v_spin public.wheel_spins;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  if v_uid is null then
    if v_order.created_by_id is not null or v_order.created_date < now() - interval '1 hour' then
      return jsonb_build_object('success', false, 'message', 'Auth required');
    end if;
  else
    v_is_owner := (v_order.created_by_id = v_uid) or (v_order.customer_email = v_email);
    if not v_is_owner and not is_admin() then
      return jsonb_build_object('success', false, 'message', 'Forbidden');
    end if;
  end if;

  select * into v_dc from public.discount_codes where id = p_code_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Code not found');
  end if;

  -- The only change from the previous version: null-safe comparison so a
  -- null order.discount_code (secure_order already invalidated/cleared it)
  -- is rejected exactly like a real mismatch, instead of silently passing.
  if v_order.discount_code is distinct from v_dc.code then
    return jsonb_build_object('success', false, 'message', 'Code not applied to this order');
  end if;

  if v_dc.owner_email is not null and v_order.customer_email <> v_dc.owner_email and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'This code belongs to another customer');
  end if;

  if v_order.discount_counted then
    return jsonb_build_object('success', true, 'message', 'already counted');
  end if;

  update public.discount_codes set used_count = coalesce(used_count, 0) + 1, updated_date = now() where id = p_code_id;
  update public.orders set discount_counted = true, updated_date = now() where id = p_order_id;

  if v_dc.wheel_spin_id is not null then
    select * into v_spin from public.wheel_spins where id = v_dc.wheel_spin_id;
    if found and v_spin.status = 'unused' and v_spin.user_email = v_order.customer_email then
      update public.wheel_spins set status = 'used', redeemed_order_id = p_order_id, updated_date = now() where id = v_spin.id;
    end if;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.redeem_discount(uuid, uuid) from public;
grant execute on function public.redeem_discount(uuid, uuid) to authenticated, anon;
