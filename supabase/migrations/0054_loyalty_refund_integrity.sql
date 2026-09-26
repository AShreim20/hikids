-- Loyalty refund integrity + pay-with-points payment status.
-- (0053 is already applied and is not modified.)
--
-- 1) Double refund. A redemption could be returned more than once:
--    release_loyalty_points (checkout failed) gave the points back, and a later
--    reverse_order_loyalty refunded orders.loyalty_points AGAIN, leaving the
--    wallet above what it would have been had the redemption never happened.
--    Now every path that returns redemption points first computes what has
--    already been returned for that redemption (_redemption_returned: the
--    release, any reconciliation adjustment and any order refund) and only
--    returns the remainder. The refund of an order is also capped by the
--    redemption that really exists in the ledger, so an order with no backing
--    redemption refunds 0.
--
--    Lock order (all paths): order row -> redemption ledger row -> wallet row.
--    reverse_order_loyalty and release_loyalty_points now lock the redemption
--    row BEFORE touching the wallet, and re-read "already returned" after the
--    lock, so concurrent release/reversal serialize instead of both refunding.
--
-- 2) Payment status. Checkout inserts payment_status = 'paid' for orders paid
--    with loyalty points, but under the current settings delivery is not
--    redeemable with points, so the server-authoritative total can still be > 0.
--    secure_order now downgrades such an order to 'unpaid' (cash still due).
--    An order whose final total is 0 keeps 'paid'. Rates, minimum, cap and
--    delivery rules are unchanged.

create or replace function public._redemption_returned(p_key text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(t.points), 0)::int
  from public.loyalty_transactions t
  where t.idempotency_key = 'release:' || p_key
     or left(t.idempotency_key, length('redeem_adjust:' || p_key || ':')) = 'redeem_adjust:' || p_key || ':'
     or t.idempotency_key in (select 'refund:' || o.id::text from public.orders o where o.loyalty_redeem_key = p_key);
$$;
revoke all on function public._redemption_returned(text) from public, anon, authenticated;

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
  v_wallet public.loyalty_accounts;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if v_key = '' then
    return jsonb_build_object('success', false, 'message', 'idempotency_key required');
  end if;

  -- Lock order: order -> redemption row -> wallet.
  if p_order_id is not null then
    perform 1 from public.orders where id = p_order_id for update;
  end if;
  select * into v_original from public.loyalty_transactions where idempotency_key = 'redeem:' || v_key for update;
  if not found then
    return jsonb_build_object('success', true, 'released', 0, 'message', 'nothing reserved');
  end if;
  if v_original.user_email <> v_email and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  v_points := greatest(0, abs(coalesce(v_original.points, 0)) - public._redemption_returned(v_key));
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

create or replace function public.reverse_order_loyalty(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_wallet public.loyalty_accounts;
  v_ref text;
  v_cancelled boolean;
  v_pending int;
  v_reversed int := 0;
  v_refunded int := 0;
  v_total_earned int;
  v_first_reward_id uuid;
  v_take int;
  v_orig public.loyalty_transactions;
  v_rkey text;
  v_spent int;
  v_net int;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if not has_permission('orders.manage') and not has_permission('loyalty.remove') then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;
  if v_order.loyalty_reversed then
    return jsonb_build_object('success', true, 'message', 'already reversed', 'reversed', 0, 'refunded', 0);
  end if;

  -- Lock order: order (above) -> redemption row -> wallet (below).
  select * into v_orig from public.loyalty_transactions
  where order_id = p_order_id and type = 'REDEMPTION' order by created_date limit 1 for update;
  if v_orig.id is null and v_order.loyalty_redeem_key is not null then
    select * into v_orig from public.loyalty_transactions
    where idempotency_key = 'redeem:' || v_order.loyalty_redeem_key and type = 'REDEMPTION' for update;
  end if;

  v_ref := upper(right(p_order_id::text, 8));
  v_cancelled := v_order.status = 'cancelled';
  v_wallet := public.get_or_create_wallet(
    p_user_id => v_order.created_by_id, p_user_email => v_order.customer_email,
    p_user_name => v_order.customer_name, p_user_phone => v_order.phone
  );

  v_pending := greatest(0, coalesce(v_order.loyalty_pending_points, 0));
  if v_pending > 0 then
    v_wallet := public.loyalty_set_pending(v_wallet.id, -v_pending);
  end if;

  if v_order.loyalty_awarded then
    -- uuid has no default min()/max() aggregate — use order-by-limit instead.
    select coalesce(sum(points), 0) into v_total_earned
    from public.loyalty_transactions
    where order_id = p_order_id and type in ('PURCHASE_REWARD', 'earn');
    select id into v_first_reward_id
    from public.loyalty_transactions
    where order_id = p_order_id and type in ('PURCHASE_REWARD', 'earn')
    order by created_date asc limit 1;

    v_take := least(coalesce(v_total_earned, 0), coalesce(v_wallet.balance, 0));
    if v_take > 0 then
      perform public.post_ledger(
        p_wallet_id => v_wallet.id, p_points => -v_take,
        p_type => case when v_cancelled then 'CANCELLATION_REVERSAL' else 'RETURN_REVERSAL' end,
        p_reason => 'Reward reversed — order #' || v_ref || ' ' || case when v_cancelled then 'cancelled' else 'returned' end,
        p_order_id => p_order_id, p_actor_email => auth.jwt() ->> 'email',
        p_idempotency_key => 'reversal:' || p_order_id::text, p_reference_transaction_id => v_first_reward_id
      );
      v_reversed := v_take;
      select balance into v_wallet.balance from public.loyalty_accounts where id = v_wallet.id;
      update public.loyalty_transactions set status = 'reversed'
      where order_id = p_order_id and type in ('PURCHASE_REWARD', 'earn');
    end if;
  end if;

  -- Redemption refund: never more than the order consumed (v_spent), and never
  -- more than the redemption still has outstanding after any release /
  -- reconciliation adjustment. No backing redemption in the ledger -> 0.
  v_spent := floor(coalesce(v_order.loyalty_points, 0))::int;
  if v_spent > 0 and v_orig.id is not null then
    v_rkey := case when v_orig.idempotency_key like 'redeem:%' then substr(v_orig.idempotency_key, 8) end;
    v_net := abs(coalesce(v_orig.points, 0)) - case when v_rkey is not null then public._redemption_returned(v_rkey) else 0 end;
    v_net := least(v_spent, greatest(0, v_net));
    if v_net > 0 then
      perform public.post_ledger(
        p_wallet_id => v_wallet.id, p_points => v_net,
        p_type => case when v_cancelled then 'CANCELLATION_REVERSAL' else 'REFUND' end,
        p_reason => 'Points refunded — order #' || v_ref,
        p_order_id => p_order_id, p_actor_email => auth.jwt() ->> 'email',
        p_idempotency_key => 'refund:' || p_order_id::text, p_reference_transaction_id => v_orig.id
      );
      v_refunded := v_net;
      select balance into v_wallet.balance from public.loyalty_accounts where id = v_wallet.id;
    end if;
    update public.loyalty_transactions set status = 'reversed' where id = v_orig.id;
  end if;

  update public.orders set loyalty_reversed = true, loyalty_pending_points = 0, updated_date = now() where id = p_order_id;
  return jsonb_build_object('success', true, 'reversed', v_reversed, 'refunded', v_refunded, 'pending_dropped', v_pending, 'balance', v_wallet.balance);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

-- secure_order: unchanged flow, plus (a) the free-delivery step now runs before
-- the loyalty reconciliation (same lock order as before: order -> spin, then
-- redemption -> wallet), and (b) a loyalty-paid order whose final total is still
-- > 0 is downgraded from 'paid' to 'unpaid'.
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

  if v_spin_id is not null then
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
      where id = p_order_id;
    else
      update public.orders set free_delivery_spin_id = null, updated_date = now() where id = p_order_id;
    end if;
  end if;

  -- Ties the accepted loyalty redemption to the ledger and recomputes total.
  perform public._reconcile_order_loyalty(p_order_id);

  update public.orders set payment_status = 'unpaid', updated_date = now()
  where id = p_order_id and payment_method = 'loyalty' and payment_status = 'paid' and coalesce(total, 0) > 0;

  select * into v_o from public.orders where id = p_order_id;
  return jsonb_build_object('success', true, 'order', to_jsonb(v_o));
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
