-- Phase 6: Loyalty. Ports the remaining 9 Base44 loyalty functions on top of
-- the post_ledger()/get_or_create_wallet() core already shipped in Phase 3
-- (0005_loyalty_ledger_core.sql). Same pattern as Phase 5: pure Postgres RPC
-- functions, no Edge Functions — auth.uid()/auth.jwt() inside a SECURITY
-- DEFINER function called via PostgREST already reflect the calling user.
--
-- adjustLoyaltyPoints's original body also had a `status` branch, but the
-- frontend only ever calls it for points credit/debit (WalletAdminRow) —
-- wallet status changes always go through setWalletStatus (WalletStatusControl)
-- instead, which is the more complete implementation (reason text, "already
-- this status" guard, wallet-not-found handling). That branch is dead code
-- in the actual app, so adjust_loyalty_points below ports only the points path.

-- The read policies from Phase 0 only recognized `is_admin()`, not staff with
-- a delegated `loyalty.view` permission (Base44's `can(user, 'loyalty.view')`
-- model) — a permissioned-but-non-admin staff member could not even read the
-- wallet list this phase's admin UI needs.
drop policy if exists loyalty_accounts_read_own_or_admin on public.loyalty_accounts;
create policy loyalty_accounts_read_own_or_staff on public.loyalty_accounts for select
  using (user_email = (auth.jwt() ->> 'email') or has_permission('loyalty.view'));

drop policy if exists loyalty_transactions_read_own_or_admin on public.loyalty_transactions;
create policy loyalty_transactions_read_own_or_staff on public.loyalty_transactions for select
  using (user_email = (auth.jwt() ->> 'email') or has_permission('loyalty.view'));

-- ── internal helpers (not directly callable by clients) ────────────────────

-- Merges the `settings` key/value rows with LOYALTY_DEFAULTS from
-- base44/shared/loyalty.ts. The legacy loyalty_award_on_delivery fallback
-- migration in loadLoyaltySettings() is not ported — it only matters for a
-- store that had that pre-loyalty_award_stage setting already saved, which
-- cannot be true for this brand-new schema.
create or replace function public.loyalty_settings()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'loyalty_earn_rate', coalesce((select value from public.settings where key = 'loyalty_earn_rate' limit 1), 1),
    'loyalty_redeem_rate', coalesce((select value from public.settings where key = 'loyalty_redeem_rate' limit 1), 0.1),
    'loyalty_min_order', coalesce((select value from public.settings where key = 'loyalty_min_order' limit 1), 0),
    'loyalty_max_redeem_percent', coalesce((select value from public.settings where key = 'loyalty_max_redeem_percent' limit 1), 100),
    'loyalty_max_redeem_value', coalesce((select value from public.settings where key = 'loyalty_max_redeem_value' limit 1), 0),
    'loyalty_expiry_days', coalesce((select value from public.settings where key = 'loyalty_expiry_days' limit 1), 0),
    'loyalty_award_stage', coalesce((select value from public.settings where key = 'loyalty_award_stage' limit 1), 3),
    'loyalty_earn_on_delivery_fee', coalesce((select value from public.settings where key = 'loyalty_earn_on_delivery_fee' limit 1), 0),
    'loyalty_earn_on_discounted', coalesce((select value from public.settings where key = 'loyalty_earn_on_discounted' limit 1), 1),
    'loyalty_redeem_with_discount', coalesce((select value from public.settings where key = 'loyalty_redeem_with_discount' limit 1), 1),
    'loyalty_redeem_delivery', coalesce((select value from public.settings where key = 'loyalty_redeem_delivery' limit 1), 0),
    'loyalty_min_redeem', coalesce((select value from public.settings where key = 'loyalty_min_redeem' limit 1), 0)
  );
$$;
revoke execute on function public.loyalty_settings() from public, anon, authenticated;

-- maxRedeemable() from base44/shared/loyalty.ts.
create or replace function public.loyalty_max_redeemable(p_subtotal numeric, p_delivery_cost numeric, p_discount_amount numeric)
returns table(max_amount numeric, max_points int, rate numeric)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_settings jsonb := public.loyalty_settings();
  v_rate numeric := coalesce((v_settings->>'loyalty_redeem_rate')::numeric, 0.1);
  v_base numeric;
  v_cap numeric;
begin
  if v_rate <= 0 then v_rate := 0.1; end if;
  v_base := coalesce(p_subtotal, 0) - coalesce(p_discount_amount, 0);
  if coalesce((v_settings->>'loyalty_redeem_delivery')::numeric, 0) <> 0 then
    v_base := v_base + coalesce(p_delivery_cost, 0);
  end if;
  if v_base <= 0 then
    max_amount := 0; max_points := 0; rate := v_rate;
    return next;
    return;
  end if;
  v_cap := v_base * (coalesce((v_settings->>'loyalty_max_redeem_percent')::numeric, 100) / 100);
  if coalesce((v_settings->>'loyalty_max_redeem_value')::numeric, 0) > 0 then
    v_cap := least(v_cap, (v_settings->>'loyalty_max_redeem_value')::numeric);
  end if;
  v_cap := least(v_cap, v_base);
  max_amount := round(v_cap, 2);
  max_points := floor(v_cap / v_rate)::int;
  rate := v_rate;
  return next;
end;
$$;
revoke execute on function public.loyalty_max_redeemable(numeric, numeric, numeric) from public, anon, authenticated;

create or replace function public.loyalty_set_pending(p_wallet_id uuid, p_delta int)
returns public.loyalty_accounts
language plpgsql
security definer set search_path = public
as $$
declare v_wallet public.loyalty_accounts;
begin
  update public.loyalty_accounts
  set pending_points = greatest(0, coalesce(pending_points, 0) + p_delta)
  where id = p_wallet_id
  returning * into v_wallet;
  return v_wallet;
end;
$$;
revoke execute on function public.loyalty_set_pending(uuid, int) from public, anon, authenticated;

-- Direct-insert equivalent of the logAuditActivity Edge Function — same
-- record shape, non-blocking (matches every call site's .catch(() => {})).
create or replace function public.log_audit(p_action text, p_target_type text, p_target_id text, p_details text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  insert into public.audit_logs (action, actor_id, actor_email, actor_role, target_type, target_id, details)
  values (
    left(coalesce(p_action, ''), 120), auth.uid(), coalesce(auth.jwt()->>'email', ''), coalesce(v_role, 'user'),
    left(coalesce(p_target_type, ''), 60), left(coalesce(p_target_id, ''), 120), left(coalesce(p_details, ''), 1000)
  );
exception when others then
  null;
end;
$$;
revoke execute on function public.log_audit(text, text, text, text) from public, anon, authenticated;

-- ── getLoyaltyBalance ────────────────────────────────────────────────────
create or replace function public.get_loyalty_balance(
  p_subtotal numeric default 0, p_delivery_cost numeric default 0, p_discount_amount numeric default 0, p_limit int default 10
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_wallet public.loyalty_accounts;
  v_settings jsonb;
  v_limits record;
  v_blocked boolean;
  v_blocked_by_discount boolean;
  v_redeemable int;
  v_transactions jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  v_settings := public.loyalty_settings();
  v_wallet := public.get_or_create_wallet(p_user_id => v_uid, p_user_email => v_email);
  select * into v_limits from public.loyalty_max_redeemable(p_subtotal, p_delivery_cost, p_discount_amount);

  v_blocked := coalesce(v_wallet.status, 'active') <> 'active';
  v_blocked_by_discount := coalesce((v_settings->>'loyalty_redeem_with_discount')::int, 1) = 0 and coalesce(p_discount_amount, 0) > 0;
  v_redeemable := case when v_blocked or v_blocked_by_discount then 0 else least(v_limits.max_points, coalesce(v_wallet.balance, 0)) end;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_date desc), '[]'::jsonb) into v_transactions
  from (
    select * from public.loyalty_transactions where user_email = v_email
    order by created_date desc limit least(coalesce(p_limit, 10), 200)
  ) t;

  return jsonb_build_object(
    'success', true,
    'wallet_code', coalesce(v_wallet.wallet_code, ''),
    'status', coalesce(v_wallet.status, case when v_wallet.frozen then 'frozen' else 'active' end),
    'balance', coalesce(v_wallet.balance, 0),
    'frozen', v_blocked,
    'pending_points', coalesce(v_wallet.pending_points, 0),
    'lifetime_earned', coalesce(v_wallet.lifetime_earned, 0),
    'lifetime_spent', coalesce(v_wallet.lifetime_spent, 0),
    'lifetime_redeemed', coalesce(v_wallet.lifetime_spent, 0),
    'lifetime_removed', coalesce(v_wallet.lifetime_removed, 0),
    'expired_points', coalesce(v_wallet.expired_points, 0),
    'earn_rate', (v_settings->>'loyalty_earn_rate')::numeric,
    'redeem_rate', (v_settings->>'loyalty_redeem_rate')::numeric,
    'min_redeem', (v_settings->>'loyalty_min_redeem')::numeric,
    'max_redeem_points', v_redeemable,
    'max_redeem_amount', case when v_blocked or v_blocked_by_discount then 0 else v_limits.max_amount end,
    'blocked_by_discount', v_blocked_by_discount,
    'settings', v_settings,
    'transactions', v_transactions
  );
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.get_loyalty_balance(numeric, numeric, numeric, int) from public, anon;
grant execute on function public.get_loyalty_balance(numeric, numeric, numeric, int) to authenticated;

-- ── awardLoyaltyPoints ───────────────────────────────────────────────────
create or replace function public.award_loyalty_points(p_order_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_order public.orders;
  v_is_owner boolean;
  v_settings jsonb;
  v_earnable int;
  v_eligible numeric;
  v_discount numeric;
  v_share numeric;
  v_base numeric;
  v_wallet public.loyalty_accounts;
  v_already_pending int;
  v_stage int;
  v_reached boolean;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  v_is_owner := (v_order.created_by_id = v_uid) or (v_order.customer_email = v_email);
  if not v_is_owner and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  if v_order.loyalty_awarded then
    return jsonb_build_object('success', true, 'awarded', 0, 'message', 'already awarded');
  end if;
  if v_order.status in ('cancelled', 'returned', 'return_approved', 'failed_delivery') then
    return jsonb_build_object('success', true, 'awarded', 0, 'message', 'order not eligible');
  end if;

  v_settings := public.loyalty_settings();

  -- earnableForOrder(): line-item eligibility (skip loyalty_exempt products),
  -- guarded uuid cast since bundle/wheel-reward line items don't carry a real
  -- product id and a bare ::uuid cast on those would throw.
  if v_order.payment_method = 'loyalty' then
    v_earnable := 0;
  elsif coalesce(v_order.subtotal, 0) < coalesce((v_settings->>'loyalty_min_order')::numeric, 0) then
    v_earnable := 0;
  else
    v_discount := coalesce(v_order.discount_amount, 0) + coalesce(v_order.loyalty_discount, 0);
    if coalesce((v_settings->>'loyalty_earn_on_discounted')::int, 1) = 0 and v_discount > 0 then
      v_earnable := 0;
    else
      select coalesce(sum(coalesce((it->>'price')::numeric, 0) * coalesce((it->>'qty')::numeric, 0)), 0)
        into v_eligible
      from jsonb_array_elements(v_order.items) it
      left join public.products p
        on (it->>'id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and p.id = (it->>'id')::uuid
      where coalesce(p.loyalty_exempt, false) = false;

      if v_eligible <= 0 then
        v_earnable := 0;
      else
        v_share := case when coalesce(v_order.subtotal, 0) > 0 then least(1, v_eligible / v_order.subtotal) else 1 end;
        v_base := v_eligible - v_discount * v_share;
        if coalesce((v_settings->>'loyalty_earn_on_delivery_fee')::int, 0) = 1 then
          v_base := v_base + coalesce(v_order.delivery_cost, 0);
        end if;
        v_earnable := case when v_base > 0 then floor(v_base * coalesce((v_settings->>'loyalty_earn_rate')::numeric, 1))::int else 0 end;
      end if;
    end if;
  end if;

  v_wallet := public.get_or_create_wallet(
    p_user_id => v_order.created_by_id, p_user_email => v_order.customer_email,
    p_user_name => v_order.customer_name, p_user_phone => v_order.phone
  );
  if coalesce(v_wallet.status, 'active') <> 'active' then
    return jsonb_build_object('success', true, 'awarded', 0, 'message', 'wallet blocked');
  end if;

  v_already_pending := greatest(0, coalesce(v_order.loyalty_pending_points, 0));
  v_stage := coalesce((v_settings->>'loyalty_award_stage')::int, 3);
  v_reached := case
    when v_stage = 0 then true
    when v_stage = 1 then v_order.payment_status = 'paid'
    when v_stage = 2 then v_order.status in ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered')
    else v_order.status = 'delivered'
  end;

  if not v_reached then
    if v_earnable <> v_already_pending then
      perform public.loyalty_set_pending(v_wallet.id, v_earnable - v_already_pending);
      update public.orders set loyalty_pending_points = v_earnable, updated_date = now() where id = p_order_id;
    end if;
    return jsonb_build_object('success', true, 'awarded', 0, 'pending', v_earnable, 'message', 'pending until award stage');
  end if;

  if v_earnable > 0 then
    perform public.post_ledger(
      p_wallet_id => v_wallet.id, p_points => v_earnable, p_type => 'PURCHASE_REWARD',
      p_reason => 'Order #' || upper(right(p_order_id::text, 8)) || ' reward',
      p_order_id => p_order_id, p_actor_email => 'system',
      p_idempotency_key => 'reward:' || p_order_id::text,
      p_expires_at => case when coalesce((v_settings->>'loyalty_expiry_days')::int, 0) > 0
        then now() + (coalesce((v_settings->>'loyalty_expiry_days')::int, 0) || ' days')::interval else null end
    );
  end if;
  if v_already_pending > 0 then
    perform public.loyalty_set_pending(v_wallet.id, -v_already_pending);
  end if;

  update public.orders set loyalty_awarded = true, loyalty_pending_points = 0, updated_date = now() where id = p_order_id;
  return jsonb_build_object('success', true, 'awarded', v_earnable);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.award_loyalty_points(uuid) from public, anon;
grant execute on function public.award_loyalty_points(uuid) to authenticated;

-- ── redeemLoyaltyPoints ──────────────────────────────────────────────────
create or replace function public.redeem_loyalty_points(
  p_points int, p_subtotal numeric default 0, p_delivery_cost numeric default 0, p_discount_amount numeric default 0,
  p_order_id uuid default null, p_idempotency_key text default null, p_reason text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_requested int := floor(coalesce(p_points, 0));
  v_settings jsonb;
  v_wallet public.loyalty_accounts;
  v_limits record;
  v_points int;
  v_amount numeric;
  v_key text;
  v_tx public.loyalty_transactions;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if v_requested <= 0 then
    return jsonb_build_object('success', false, 'message', 'Enter points to redeem');
  end if;

  v_settings := public.loyalty_settings();
  v_wallet := public.get_or_create_wallet(p_user_id => v_uid, p_user_email => v_email);
  if coalesce(v_wallet.status, 'active') <> 'active' then
    return jsonb_build_object('success', false, 'message', 'Wallet is not active');
  end if;
  if coalesce((v_settings->>'loyalty_redeem_with_discount')::int, 1) = 0 and coalesce(p_discount_amount, 0) > 0 then
    return jsonb_build_object('success', false, 'message', 'Points cannot be combined with a discount code');
  end if;
  if coalesce((v_settings->>'loyalty_min_redeem')::numeric, 0) > 0 and v_requested < (v_settings->>'loyalty_min_redeem')::numeric then
    return jsonb_build_object('success', false, 'message', 'Minimum ' || (v_settings->>'loyalty_min_redeem') || ' points per redemption');
  end if;
  if coalesce(v_wallet.balance, 0) < v_requested then
    return jsonb_build_object('success', false, 'message', 'Insufficient points');
  end if;

  select * into v_limits from public.loyalty_max_redeemable(p_subtotal, p_delivery_cost, p_discount_amount);
  v_points := least(v_requested, v_limits.max_points);
  if v_points <= 0 then
    return jsonb_build_object('success', false, 'message', 'Points cannot be applied to this order');
  end if;
  v_amount := least(round(v_points * v_limits.rate, 2), v_limits.max_amount);
  v_key := case when p_idempotency_key is not null and p_idempotency_key <> '' then 'redeem:' || p_idempotency_key else null end;

  begin
    v_tx := public.post_ledger(
      p_wallet_id => v_wallet.id, p_points => -v_points, p_type => 'REDEMPTION',
      p_reason => coalesce(nullif(p_reason, ''), 'Redeemed at checkout'),
      p_order_id => p_order_id, p_actor_email => v_email, p_idempotency_key => v_key
    );
  exception when others then
    if sqlerrm = 'insufficient_points' then
      return jsonb_build_object('success', false, 'message', 'Insufficient points');
    end if;
    raise;
  end;

  return jsonb_build_object(
    'success', true, 'points', v_points, 'amount', v_amount,
    'balance', (select balance from public.loyalty_accounts where id = v_wallet.id),
    'transaction_id', v_tx.id
  );
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.redeem_loyalty_points(int, numeric, numeric, numeric, uuid, text, text) from public, anon;
grant execute on function public.redeem_loyalty_points(int, numeric, numeric, numeric, uuid, text, text) to authenticated;

-- ── releaseLoyaltyPoints ─────────────────────────────────────────────────
create or replace function public.release_loyalty_points(p_idempotency_key text, p_order_id uuid default null)
returns jsonb
language plpgsql
security definer set search_path = public
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

  select * into v_original from public.loyalty_transactions where idempotency_key = 'redeem:' || v_key;
  if not found then
    return jsonb_build_object('success', true, 'released', 0, 'message', 'nothing reserved');
  end if;
  if v_original.user_email <> v_email and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  v_points := abs(coalesce(v_original.points, 0));
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
revoke execute on function public.release_loyalty_points(text, uuid) from public, anon;
grant execute on function public.release_loyalty_points(text, uuid) to authenticated;

-- ── reverseOrderLoyalty ──────────────────────────────────────────────────
create or replace function public.reverse_order_loyalty(p_order_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
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
  v_original_redeem_id uuid;
  v_spent int;
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

  v_spent := floor(coalesce(v_order.loyalty_points, 0))::int;
  if v_spent > 0 then
    select id into v_original_redeem_id from public.loyalty_transactions
    where order_id = p_order_id and type = 'REDEMPTION' limit 1;
    if v_original_redeem_id is null and v_order.loyalty_redeem_key is not null then
      select id into v_original_redeem_id from public.loyalty_transactions
      where idempotency_key = 'redeem:' || v_order.loyalty_redeem_key limit 1;
    end if;

    perform public.post_ledger(
      p_wallet_id => v_wallet.id, p_points => v_spent,
      p_type => case when v_cancelled then 'CANCELLATION_REVERSAL' else 'REFUND' end,
      p_reason => 'Points refunded — order #' || v_ref,
      p_order_id => p_order_id, p_actor_email => auth.jwt() ->> 'email',
      p_idempotency_key => 'refund:' || p_order_id::text, p_reference_transaction_id => v_original_redeem_id
    );
    v_refunded := v_spent;
    select balance into v_wallet.balance from public.loyalty_accounts where id = v_wallet.id;
    if v_original_redeem_id is not null then
      update public.loyalty_transactions set status = 'reversed' where id = v_original_redeem_id;
    end if;
  end if;

  update public.orders set loyalty_reversed = true, loyalty_pending_points = 0, updated_date = now() where id = p_order_id;
  return jsonb_build_object('success', true, 'reversed', v_reversed, 'refunded', v_refunded, 'pending_dropped', v_pending, 'balance', v_wallet.balance);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.reverse_order_loyalty(uuid) from public, anon;
grant execute on function public.reverse_order_loyalty(uuid) to authenticated;

-- ── adjustLoyaltyPoints (points path only — see header note) ────────────
create or replace function public.adjust_loyalty_points(p_user_email text, p_points int, p_reason text, p_user_name text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := trim(coalesce(p_user_email, ''));
  v_delta int := trunc(coalesce(p_points, 0));
  v_reason text := trim(coalesce(p_reason, ''));
  v_wallet public.loyalty_accounts;
  v_tx public.loyalty_transactions;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if v_email = '' then
    return jsonb_build_object('success', false, 'message', 'user_email required');
  end if;
  if v_delta = 0 then
    return jsonb_build_object('success', false, 'message', 'points required');
  end if;
  if not has_permission(case when v_delta > 0 then 'loyalty.add' else 'loyalty.remove' end) then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;
  if v_reason = '' then
    return jsonb_build_object('success', false, 'message', 'A reason is required');
  end if;

  v_wallet := public.get_or_create_wallet(p_user_id => null, p_user_email => v_email, p_user_name => p_user_name);

  begin
    v_tx := public.post_ledger(
      p_wallet_id => v_wallet.id, p_points => v_delta,
      p_type => case when v_delta > 0 then 'ADMIN_CREDIT' else 'ADMIN_DEBIT' end,
      p_reason => v_reason, p_actor_email => auth.jwt() ->> 'email'
    );
  exception when others then
    if sqlerrm = 'insufficient_points' then
      return jsonb_build_object('success', false, 'message', 'Balance cannot go negative');
    end if;
    raise;
  end;

  perform public.log_audit(
    case when v_delta > 0 then 'loyalty.credit' else 'loyalty.debit' end,
    'loyalty_wallet', v_wallet.id::text,
    v_email || ': ' || (case when v_delta > 0 then '+' else '' end) || v_delta || ' — ' || v_reason
  );

  return jsonb_build_object('success', true, 'balance', (select balance from public.loyalty_accounts where id = v_wallet.id), 'points', v_delta);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.adjust_loyalty_points(text, int, text, text) from public, anon;
grant execute on function public.adjust_loyalty_points(text, int, text, text) to authenticated;

-- ── setWalletStatus ──────────────────────────────────────────────────────
create or replace function public.set_wallet_status(p_status text, p_wallet_id uuid default null, p_user_email text default null, p_reason text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text := lower(coalesce(p_status, ''));
  v_wallet public.loyalty_accounts;
  v_current text;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Please sign in again.');
  end if;
  if not has_permission('loyalty.settings') then
    return jsonb_build_object('success', false, 'message', 'You do not have permission to change this wallet status.');
  end if;
  if v_status not in ('active', 'frozen', 'suspended') then
    return jsonb_build_object('success', false, 'message', 'Invalid wallet status.');
  end if;

  if p_wallet_id is not null then
    select * into v_wallet from public.loyalty_accounts where id = p_wallet_id;
  elsif p_user_email is not null then
    select * into v_wallet from public.loyalty_accounts where user_email = trim(p_user_email) limit 1;
  end if;
  if v_wallet.id is null then
    return jsonb_build_object('success', false, 'message', 'Wallet not found.');
  end if;

  v_current := coalesce(v_wallet.status, case when v_wallet.frozen then 'frozen' else 'active' end);
  if v_current = v_status then
    return jsonb_build_object(
      'success', false,
      'message', case when v_status = 'active' then 'This wallet is already active.' else 'This wallet is already ' || v_status || '.' end,
      'wallet', to_jsonb(v_wallet)
    );
  end if;

  update public.loyalty_accounts
  set status = v_status, frozen = (v_status <> 'active'), last_activity_at = now()
  where id = v_wallet.id
  returning * into v_wallet;

  insert into public.loyalty_transactions (
    account_id, wallet_code, user_id, user_email, points, type, status, reason, balance_before, balance_after, actor_email
  ) values (
    v_wallet.id, v_wallet.wallet_code, v_wallet.user_id, v_wallet.user_email, 0, 'ADJUSTMENT', 'completed',
    'Wallet ' || v_status || ' (was ' || v_current || ')' || case when v_reason <> '' then ' — ' || v_reason else '' end,
    coalesce(v_wallet.balance, 0), coalesce(v_wallet.balance, 0), auth.jwt() ->> 'email'
  );

  perform public.log_audit(
    'loyalty.wallet_' || v_status, 'loyalty_wallet', v_wallet.id::text,
    v_wallet.user_email || ': ' || v_current || ' → ' || v_status || case when v_reason <> '' then ' — ' || v_reason else '' end
  );

  return jsonb_build_object('success', true, 'status', v_status, 'previous_status', v_current, 'wallet', to_jsonb(v_wallet));
exception when others then
  return jsonb_build_object('success', false, 'message', coalesce(sqlerrm, 'Wallet status could not be updated.'));
end;
$$;
revoke execute on function public.set_wallet_status(text, uuid, text, text) from public, anon;
grant execute on function public.set_wallet_status(text, uuid, text, text) to authenticated;

-- ── loyaltyDashboard ─────────────────────────────────────────────────────
create or replace function public.loyalty_dashboard_stats()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_settings jsonb;
  v_wallets int; v_active int; v_circ numeric; v_pending numeric; v_earned numeric; v_redeemed numeric; v_expired numeric;
  v_month_start timestamptz := date_trunc('month', now());
  v_earned_month numeric; v_redeemed_month numeric;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if not has_permission('loyalty.view') then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  v_settings := public.loyalty_settings();

  select count(*), count(*) filter (where not (coalesce(frozen, false) or coalesce(status, 'active') <> 'active')),
         coalesce(sum(balance), 0), coalesce(sum(pending_points), 0), coalesce(sum(lifetime_earned), 0),
         coalesce(sum(lifetime_spent), 0), coalesce(sum(expired_points), 0)
  into v_wallets, v_active, v_circ, v_pending, v_earned, v_redeemed, v_expired
  from public.loyalty_accounts;

  select coalesce(sum(points) filter (where type in ('PURCHASE_REWARD', 'ADMIN_CREDIT', 'earn') and points > 0), 0),
         coalesce(sum(-points) filter (where type in ('REDEMPTION', 'redeem') and points < 0), 0)
  into v_earned_month, v_redeemed_month
  from public.loyalty_transactions
  where created_date >= v_month_start;

  return jsonb_build_object('success', true, 'stats', jsonb_build_object(
    'wallets', v_wallets, 'active_wallets', v_active, 'in_circulation', v_circ, 'pending', v_pending,
    'earned', v_earned, 'redeemed', v_redeemed, 'expired', v_expired,
    'earned_this_month', v_earned_month, 'redeemed_this_month', v_redeemed_month,
    'point_value', (v_settings->>'loyalty_redeem_rate')::numeric
  ));
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.loyalty_dashboard_stats() from public, anon;
grant execute on function public.loyalty_dashboard_stats() to authenticated;

-- ── adminLoyaltyWallet ───────────────────────────────────────────────────
create or replace function public.admin_loyalty_wallet(p_user_email text, p_limit int default 50)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := trim(coalesce(p_user_email, ''));
  v_wallet public.loyalty_accounts;
  v_transactions jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if not has_permission('loyalty.view') then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;
  if v_email = '' then
    return jsonb_build_object('success', false, 'message', 'user_email required');
  end if;

  select * into v_wallet from public.loyalty_accounts where user_email = v_email limit 1;

  if has_permission('loyalty.transactions.view') then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_date desc), '[]'::jsonb) into v_transactions
    from (
      select * from public.loyalty_transactions where user_email = v_email
      order by created_date desc limit least(coalesce(p_limit, 50), 200)
    ) t;
  end if;

  return jsonb_build_object('success', true, 'wallet', case when v_wallet.id is null then null else to_jsonb(v_wallet) end, 'transactions', v_transactions);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.admin_loyalty_wallet(text, int) from public, anon;
grant execute on function public.admin_loyalty_wallet(text, int) to authenticated;
