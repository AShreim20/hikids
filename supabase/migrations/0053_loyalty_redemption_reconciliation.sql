-- Loyalty redemption consistency.
--
-- Checkout deducts points FIRST (redeem_loyalty_points, sized from the client's
-- own cart numbers, keyed 'redeem:<checkout key>'), then inserts the order and
-- calls secure_order, which re-prices the order from the database and may accept
-- FEWER points than were deducted (stale prices, changed cart, delivery/category
-- rules). Nothing reconciled the difference, so the customer silently lost it.
-- The same trust gap existed in reverse: secure_order took orders.loyalty_points
-- from the client without checking the ledger, so an order claiming points that
-- were never redeemed still received the discount.
--
-- Fix: after secure_order secures an order, the ledger becomes the source of
-- truth.
--   accepted points S = least(points the server accepted, points actually
--                              redeemed for this order's key and owner, and not
--                              already claimed by another order with that key)
--   unused points   = redeemed - S   -> refunded exactly once (idempotent key)
-- Business rules (rate, minimum, cap, earning, release, returns) are unchanged;
-- reverse_order_loyalty keeps refunding orders.loyalty_points, which now always
-- equals what was really consumed.
--
-- release_loyalty_points (checkout failed after the deduction) is adjusted so it
-- never re-refunds points this reconciliation already returned.

create or replace function public._reconcile_order_loyalty(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_o public.orders;
  v_key text;
  v_tx public.loyalty_transactions;
  v_redeemed int := 0;
  v_claimed int := 0;
  v_available int;
  v_s int;
  v_accepted int;
  v_unused int;
  v_rate numeric;
  v_disc numeric;
  v_wallet public.loyalty_accounts;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then return; end if;

  v_key := nullif(trim(coalesce(v_o.loyalty_redeem_key, '')), '');
  v_accepted := greatest(0, coalesce(v_o.loyalty_points, 0));
  if v_key is null and v_accepted = 0 then return; end if;

  -- Points really deducted for this checkout, by this order's owner. Locking the
  -- ledger row serializes concurrent orders claiming the same redemption.
  if v_key is not null and v_o.created_by_id is not null then
    select * into v_tx from public.loyalty_transactions
    where idempotency_key = 'redeem:' || v_key
      and type = 'REDEMPTION'
      and user_id = v_o.created_by_id
      and coalesce(status, '') <> 'reversed'
    for update;
    if found then v_redeemed := abs(coalesce(v_tx.points, 0)); end if;
  end if;

  -- Points of this redemption already claimed by OTHER secured orders using the
  -- same key (a redemption can back only one order).
  if v_tx.id is not null then
    select coalesce(sum(greatest(0, coalesce(o.loyalty_points, 0))), 0)::int into v_claimed
    from public.orders o
    where o.loyalty_redeem_key = v_o.loyalty_redeem_key and o.id <> p_order_id and o.secured;
  end if;
  v_available := greatest(0, v_redeemed - v_claimed);
  v_s := least(v_accepted, v_available);

  if v_s <> v_accepted then
    select coalesce(max(value) filter (where key = 'loyalty_redeem_rate'), 0.1) into v_rate from public.settings;
    if v_rate is null or v_rate <= 0 then v_rate := 0.1; end if;
    v_disc := case when v_s > 0 then round(v_s * v_rate, 2) else 0 end;
    update public.orders set
      loyalty_points = v_s,
      loyalty_discount = v_disc,
      total = greatest(0, round(coalesce(subtotal, 0) + coalesce(delivery_cost, 0) - coalesce(discount_amount, 0) - v_disc, 2)),
      updated_date = now()
    where id = p_order_id;
  end if;

  v_unused := v_available - v_s;
  if v_tx.id is not null and v_unused > 0 then
    v_wallet := public.get_or_create_wallet(p_user_id => v_tx.user_id, p_user_email => v_tx.user_email);
    perform public.post_ledger(
      p_wallet_id => v_wallet.id, p_points => v_unused, p_type => 'REFUND',
      p_reason => 'Unused redeemed points returned — final order discount was lower',
      p_order_id => p_order_id, p_actor_email => null,
      p_idempotency_key => 'redeem_adjust:' || v_key || ':' || p_order_id::text,
      p_reference_transaction_id => v_tx.id
    );
  end if;
end;
$$;

revoke all on function public._reconcile_order_loyalty(uuid) from public, anon, authenticated;

create or replace function public.secure_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_secured boolean; v_spin_id uuid; v_res jsonb; v_o public.orders; v_spin public.wheel_spins;
begin
  select secured, free_delivery_spin_id into v_was_secured, v_spin_id from public.orders where id = p_order_id;
  v_res := public._secure_order_base(p_order_id);
  if not coalesce((v_res->>'success')::boolean, false) or coalesce(v_was_secured, false) then
    return v_res;
  end if;

  -- Newly secured: tie the accepted loyalty redemption to the ledger.
  perform public._reconcile_order_loyalty(p_order_id);

  if v_spin_id is null then
    select * into v_o from public.orders where id = p_order_id;
    return jsonb_build_object('success', true, 'order', to_jsonb(v_o));
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  select * into v_spin from public.wheel_spins where id = v_spin_id for update;
  if v_o.created_by_id is not null and found
     and v_spin.user_id = v_o.created_by_id
     and v_spin.reward_type = 'free_delivery' and v_spin.status = 'unused'
     and (v_spin.expires_at is null or v_spin.expires_at >= now())
     and coalesce(v_o.delivery_cost, 0) > 0 then
    update public.wheel_spins set status = 'used', redeemed_order_id = p_order_id, updated_date = now() where id = v_spin_id;
    update public.orders set
      delivery_cost = 0,
      total = greatest(0, round(coalesce(subtotal, 0) - coalesce(discount_amount, 0) - coalesce(loyalty_discount, 0), 2)),
      updated_date = now()
    where id = p_order_id returning * into v_o;
  else
    update public.orders set free_delivery_spin_id = null, updated_date = now() where id = p_order_id returning * into v_o;
  end if;
  return jsonb_build_object('success', true, 'order', to_jsonb(v_o));
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

-- Checkout failed after points were deducted: give back what is still consumed.
-- Identical to the previous version except that points already returned by
-- _reconcile_order_loyalty are subtracted, so nothing is refunded twice.
create or replace function public.release_loyalty_points(p_idempotency_key text, p_order_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_original public.loyalty_transactions;
  v_points int;
  v_adjusted int;
  v_wallet public.loyalty_accounts;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if v_key = '' then
    return jsonb_build_object('success', false, 'message', 'idempotency_key required');
  end if;

  select * into v_original from public.loyalty_transactions where idempotency_key = 'redeem:' || v_key;
  if not found then
    return jsonb_build_object('success', true, 'released', 0, 'message', 'nothing reserved');
  end if;
  if v_original.user_email <> v_email and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  select coalesce(sum(points), 0)::int into v_adjusted
  from public.loyalty_transactions
  where idempotency_key like 'redeem_adjust:' || v_key || ':%' and type = 'REFUND';

  v_points := greatest(0, abs(coalesce(v_original.points, 0)) - v_adjusted);
  if v_points = 0 then
    return jsonb_build_object('success', true, 'released', 0);
  end if;

  v_wallet := public.get_or_create_wallet(p_user_id => v_original.user_id, p_user_email => v_original.user_email);

  perform public.post_ledger(
    p_wallet_id => v_wallet.id, p_points => v_points, p_type => 'REFUND',
    p_reason => 'Reserved points released — checkout not completed',
    p_order_id => v_original.order_id, p_actor_email => v_email,
    p_idempotency_key => 'release:' || v_key, p_reference_transaction_id => v_original.id
  );

  update public.loyalty_transactions set status = 'reversed' where id = v_original.id;
  if p_order_id is not null then
    update public.orders set loyalty_released = true, updated_date = now() where id = p_order_id;
  end if;

  return jsonb_build_object('success', true, 'released', v_points, 'balance', (select balance from public.loyalty_accounts where id = v_wallet.id));
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

-- Grants unchanged from the previous definitions (secure_order / release_loyalty_points
-- keep their existing EXECUTE privileges; create or replace preserves them).
