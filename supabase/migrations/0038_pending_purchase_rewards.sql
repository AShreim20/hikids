-- Phase 6: purchase-earned Points and Spins stay PENDING during the 3-day
-- return window (starts at the order's actual Delivered At), are held while a
-- valid Return/Exchange is open, and are recalculated from the final retained
-- value once it is resolved.
--
-- Scope/safety:
--   * Only NEW orders are affected. Every existing order is backfilled with
--     rewards_managed = false, so existing balances/spin counts do not change.
--   * The Welcome spin (wheel_progress.free_spin_granted), challenge rewards
--     and admin credits are never touched -- only PURCHASE_REWARD points and
--     purchase-order spins are managed here.
--   * Release/reconcile are server-side and idempotent (order row lock +
--     ledger idempotency keys). No new scheduler framework: pg_cron (hourly
--     sweep) plus a lazy sweep whenever a customer's wheel state is read.

-- ---------------------------------------------------------------------------
-- 1. Columns (existing rows: unmanaged, so behaviour is unchanged)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists rewards_managed boolean not null default true,
  add column if not exists rewards_release_at timestamptz,
  add column if not exists rewards_released_at timestamptz,
  add column if not exists rewards_released_early boolean not null default false,
  add column if not exists rewards_released_by uuid references auth.users(id),
  add column if not exists rewards_points_awarded integer not null default 0,
  add column if not exists rewards_reconcile_seq integer not null default 0,
  add column if not exists rewards_review_needed boolean not null default false;

update public.orders set rewards_managed = false;

-- ---------------------------------------------------------------------------
-- 2. Triggers: sanitize inserts, start the window at Delivered At
-- ---------------------------------------------------------------------------
create or replace function public.orders_rewards_insert_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.rewards_managed := true;
  new.rewards_release_at := null;
  new.rewards_released_at := null;
  new.rewards_released_early := false;
  new.rewards_released_by := null;
  new.rewards_points_awarded := 0;
  new.rewards_reconcile_seq := 0;
  new.rewards_review_needed := false;
  return new;
end;
$$;
drop trigger if exists orders_rewards_insert_guard on public.orders;
create trigger orders_rewards_insert_guard before insert on public.orders
  for each row execute function public.orders_rewards_insert_guard();

create or replace function public.orders_rewards_set_release_at()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_delivered timestamptz;
begin
  if new.rewards_managed and new.rewards_release_at is null and new.status = 'delivered' then
    select max((e->>'at')::timestamptz) into v_delivered
      from jsonb_array_elements(coalesce(new.activity, '[]'::jsonb)) e
      where e->>'action' = 'status' and e->>'to' = 'delivered';
    new.rewards_release_at := coalesce(v_delivered, now()) + interval '3 days';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_rewards_set_release_at on public.orders;
create trigger orders_rewards_set_release_at before update on public.orders
  for each row execute function public.orders_rewards_set_release_at();

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
-- Net merchandise value already returned (settlement completed, not reversed).
-- Exchanges only reduce by (returned eligible value - replacement value).
create or replace function public._returned_net(p_order_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    -- Exchange: replacement value keeps rewards only up to the value returned;
    -- a price difference is never rewarded (paid or not).
    s.eligible_merchandise_value - case when s.request_type = 'exchange' then
      least(s.eligible_merchandise_value,
        coalesce((select sum(coalesce((e->>'replacement_unit_price')::numeric, 0) * coalesce((e->>'replacement_quantity')::numeric, 0))
                  from jsonb_array_elements(s.item_breakdown) e), 0))
    else 0 end
  ), 0)
  from public.return_settlements s
  where s.order_id = p_order_id and s.status = 'completed';
$$;
revoke execute on function public._returned_net(uuid) from public, anon, authenticated;

-- A valid return/exchange is still open (submitted inside the window, not yet
-- resolved/rejected/cancelled).
create or replace function public._active_return_exists(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.return_requests r
    join public.orders o on o.id = r.order_id
    where r.order_id = p_order_id
      and r.status in ('submitted','under_review','needs_information','approved','awaiting_return','received','processing')
      and (o.rewards_release_at is null or r.submitted_at is null or r.submitted_at <= o.rewards_release_at)
  );
$$;
revoke execute on function public._active_return_exists(uuid) from public, anon, authenticated;

-- Same earning rules as award_loyalty_points (current loyalty settings), on the
-- FINAL retained value.
create or replace function public._order_final_points(p_order_id uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_order public.orders; v_settings jsonb; v_eligible numeric; v_discount numeric;
  v_share numeric; v_base numeric := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.payment_method = 'loyalty' then return 0; end if;
  v_settings := public.loyalty_settings();
  if coalesce(v_order.subtotal, 0) < coalesce((v_settings->>'loyalty_min_order')::numeric, 0) then return 0; end if;
  v_discount := coalesce(v_order.discount_amount, 0) + coalesce(v_order.loyalty_discount, 0);
  if coalesce((v_settings->>'loyalty_earn_on_discounted')::int, 1) = 0 and v_discount > 0 then return 0; end if;
  select coalesce(sum(coalesce((it->>'price')::numeric, 0) * coalesce((it->>'qty')::numeric, 0)), 0) into v_eligible
  from jsonb_array_elements(v_order.items) it
  left join public.products p on p.id::text = (it->>'id')
  where coalesce(p.loyalty_exempt, false) = false;
  if v_eligible <= 0 then return 0; end if;
  v_share := case when coalesce(v_order.subtotal, 0) > 0 then least(1, v_eligible / v_order.subtotal) else 1 end;
  v_base := v_eligible - v_discount * v_share;
  if coalesce((v_settings->>'loyalty_earn_on_delivery_fee')::int, 0) = 1 then
    v_base := v_base + coalesce(v_order.delivery_cost, 0);
  end if;
  v_base := v_base - case when v_order.rewards_managed then public._returned_net(p_order_id) else 0 end;
  return case when v_base > 0 then floor(v_base * coalesce((v_settings->>'loyalty_earn_rate')::numeric, 1))::int else 0 end;
end;
$$;
revoke execute on function public._order_final_points(uuid) from public, anon, authenticated;

-- Purchase-spin eligibility for a user: [eligible, earned]. Managed orders only
-- count once released (or when explicitly included as pending/previewed).
create or replace function public._wheel_purchase(p_user_id uuid, p_cfg public.wheel_config, p_include_pending boolean, p_extra uuid default null)
returns numeric[] language plpgsql stable security definer set search_path = public as $$
declare
  v_min numeric := coalesce(p_cfg.min_amount, 0);
  v_eligible numeric := 0; v_earned numeric := 0;
begin
  if p_cfg.basis = 'single_order' then
    select count(*) into v_earned from (
      select coalesce(o.subtotal, 0) - case when o.rewards_managed then public._returned_net(o.id) else 0 end as sub
      from public.orders o
      where o.created_by_id = p_user_id
        and o.status not in ('cancelled','returned','return_approved','failed_delivery')
        and (not o.rewards_managed or o.rewards_released_at is not null
             or (p_include_pending and o.rewards_release_at is not null) or o.id = p_extra)
    ) a where a.sub >= v_min;
    return array[v_earned, v_earned];
  end if;
  select coalesce(sum(a.val), 0) into v_eligible from (
    select greatest(0, coalesce(o.subtotal, 0) - coalesce(o.discount_amount, 0) - coalesce(o.loyalty_discount, 0)
             - case when o.rewards_managed then public._returned_net(o.id) else 0 end) as val, o.created_date
    from public.orders o
    where o.created_by_id = p_user_id
      and o.status not in ('cancelled','returned','return_approved','failed_delivery')
      and (not o.rewards_managed or o.rewards_released_at is not null
           or (p_include_pending and o.rewards_release_at is not null) or o.id = p_extra)
  ) a
  where p_cfg.basis <> 'period'
     or ((p_cfg.period_start is null or a.created_date >= p_cfg.period_start)
         and (p_cfg.period_end is null or a.created_date <= p_cfg.period_end));
  v_earned := case when v_min > 0 then floor(v_eligible / v_min) else 0 end;
  return array[v_eligible, v_earned];
end;
$$;
revoke execute on function public._wheel_purchase(uuid, public.wheel_config, boolean, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Release (auto / early) and reconcile
-- ---------------------------------------------------------------------------
create or replace function public._order_spin_delta(p_order_id uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_order public.orders; v_cfg public.wheel_config; v_with numeric[]; v_without numeric[];
begin
  select * into v_order from public.orders where id = p_order_id;
  select * into v_cfg from public.wheel_config where active = true order by created_date desc limit 1;
  if v_cfg.id is null or v_order.created_by_id is null then return 0; end if;
  v_with := public._wheel_purchase(v_order.created_by_id, v_cfg, false, p_order_id);
  v_without := public._wheel_purchase(v_order.created_by_id, v_cfg, false, null);
  return greatest(0, (v_with[2] - v_without[2])::int);
end;
$$;
revoke execute on function public._order_spin_delta(uuid) from public, anon, authenticated;

create or replace function public._release_order_rewards(p_order_id uuid, p_actor text, p_early boolean, p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders; v_pts int; v_spins int; v_wallet public.loyalty_accounts; v_pending int; v_settings jsonb;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not v_order.rewards_managed then return jsonb_build_object('released', false, 'reason', 'not_managed'); end if;
  if v_order.rewards_released_at is not null then return jsonb_build_object('released', false, 'reason', 'already_released'); end if;
  if v_order.rewards_release_at is null or v_order.status <> 'delivered' then
    return jsonb_build_object('released', false, 'reason', 'not_delivered');
  end if;
  if public._active_return_exists(p_order_id) then return jsonb_build_object('released', false, 'reason', 'return_hold'); end if;
  if not p_early and now() < v_order.rewards_release_at then return jsonb_build_object('released', false, 'reason', 'window_open'); end if;

  v_pts := public._order_final_points(p_order_id);
  v_spins := public._order_spin_delta(p_order_id);
  if v_pts > 0 and v_order.created_by_id is not null then
    v_wallet := public.get_or_create_wallet(p_user_id => v_order.created_by_id, p_user_email => v_order.customer_email,
      p_user_name => v_order.customer_name, p_user_phone => v_order.phone);
    if coalesce(v_wallet.status, 'active') <> 'active' then return jsonb_build_object('released', false, 'reason', 'wallet_blocked'); end if;
    v_settings := public.loyalty_settings();
    perform public.post_ledger(p_wallet_id => v_wallet.id, p_points => v_pts, p_type => 'PURCHASE_REWARD',
      p_reason => 'Order #' || upper(right(p_order_id::text, 8)) || ' reward', p_order_id => p_order_id,
      p_actor_email => p_actor, p_idempotency_key => 'reward:' || p_order_id::text,
      p_expires_at => case when coalesce((v_settings->>'loyalty_expiry_days')::int, 0) > 0
        then now() + (coalesce((v_settings->>'loyalty_expiry_days')::int, 0) || ' days')::interval else null end);
    v_pending := greatest(0, coalesce(v_order.loyalty_pending_points, 0));
    if v_pending > 0 then perform public.loyalty_set_pending(v_wallet.id, -v_pending); end if;
  end if;

  update public.orders set
    loyalty_awarded = true, loyalty_pending_points = 0,
    rewards_released_at = now(), rewards_points_awarded = v_pts,
    rewards_released_early = p_early, rewards_released_by = p_actor_id,
    activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', case when p_early then 'rewards_released_early' else 'rewards_released' end,
      'from', '', 'to', '', 'by', p_actor, 'note', 'points=' || v_pts || ' spins=' || v_spins)),
    updated_date = now()
  where id = p_order_id;
  return jsonb_build_object('released', true, 'points', v_pts, 'spins', v_spins);
end;
$$;
revoke execute on function public._release_order_rewards(uuid, text, boolean, uuid) from public, anon, authenticated;

create or replace function public._release_due_rewards(p_user_id uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_n int := 0; v_res jsonb;
begin
  for v_id in select id from public.orders
    where rewards_managed and rewards_released_at is null and rewards_release_at is not null
      and rewards_release_at <= now() and (p_user_id is null or created_by_id = p_user_id)
  loop
    v_res := public._release_order_rewards(v_id, 'system', false);
    if (v_res->>'released')::boolean then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public._release_due_rewards(uuid) from public, anon, authenticated;

-- After a Return/Exchange is finalized: release (if never released) or
-- reconcile already-released rewards to the final retained value.
create or replace function public._reconcile_order_rewards(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders; v_final int; v_delta int; v_wallet public.loyalty_accounts; v_take int; v_applied int := 0;
  v_state jsonb;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not v_order.rewards_managed then return; end if;
  if v_order.rewards_released_at is null then
    perform public._release_order_rewards(p_order_id, 'system', false);
    return;
  end if;
  if public._active_return_exists(p_order_id) then return; end if;
  v_final := public._order_final_points(p_order_id);
  v_delta := v_final - v_order.rewards_points_awarded;
  if v_delta = 0 then return; end if;
  v_wallet := public.get_or_create_wallet(p_user_id => v_order.created_by_id, p_user_email => v_order.customer_email);
  if v_delta < 0 then
    v_take := least(-v_delta, greatest(0, coalesce(v_wallet.balance, 0)));
    if v_take > 0 then
      perform public.post_ledger(p_wallet_id => v_wallet.id, p_points => -v_take, p_type => 'RETURN_REVERSAL',
        p_reason => 'Purchase reward adjusted after return', p_order_id => p_order_id, p_actor_email => 'system',
        p_idempotency_key => 'rewards_reconcile:' || p_order_id::text || ':' || (v_order.rewards_reconcile_seq + 1));
      v_applied := -v_take;
    end if;
    if v_take < -v_delta then
      update public.orders set rewards_review_needed = true where id = p_order_id;
    end if;
  else
    perform public.post_ledger(p_wallet_id => v_wallet.id, p_points => v_delta, p_type => 'PURCHASE_REWARD',
      p_reason => 'Purchase reward adjusted after return', p_order_id => p_order_id, p_actor_email => 'system',
      p_idempotency_key => 'rewards_reconcile:' || p_order_id::text || ':' || (v_order.rewards_reconcile_seq + 1));
    v_applied := v_delta;
  end if;
  update public.orders set
    rewards_points_awarded = rewards_points_awarded + v_applied,
    rewards_reconcile_seq = rewards_reconcile_seq + 1,
    activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'rewards_reconciled', 'from', '', 'to', '', 'by', 'system', 'note', 'points_delta=' || v_applied)),
    updated_date = now()
  where id = p_order_id;
  -- Spins already consumed beyond the new entitlement cannot go negative:
  -- flag for admin review instead.
  v_state := public.compute_wheel_state(v_order.created_by_id, v_order.customer_email);
  if coalesce((v_state->>'active')::boolean, false) and (v_state->>'used')::int > (v_state->>'earned')::int then
    update public.orders set rewards_review_needed = true where id = p_order_id;
  end if;
end;
$$;
revoke execute on function public._reconcile_order_rewards(uuid) from public, anon, authenticated;

create or replace function public.trg_reconcile_rewards_from_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('completed','rejected','cancelled') then
    perform public._reconcile_order_rewards(new.order_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reconcile_rewards_from_request on public.return_requests;
create trigger trg_reconcile_rewards_from_request after update on public.return_requests
  for each row execute function public.trg_reconcile_rewards_from_request();

create or replace function public.trg_reconcile_rewards_from_settlement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status = 'reversed' then
    perform public._reconcile_order_rewards(new.order_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reconcile_rewards_from_settlement on public.return_settlements;
create trigger trg_reconcile_rewards_from_settlement after update on public.return_settlements
  for each row execute function public.trg_reconcile_rewards_from_settlement();

-- ---------------------------------------------------------------------------
-- 5. award_loyalty_points: managed orders never award through it (only the
--    release does); they only keep their PENDING points up to date.
-- ---------------------------------------------------------------------------
alter function public.award_loyalty_points(uuid) rename to _award_loyalty_points_legacy;
revoke execute on function public._award_loyalty_points_legacy(uuid) from public, anon, authenticated;

create or replace function public.award_loyalty_points(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_email text := auth.jwt() ->> 'email';
  v_order public.orders; v_wallet public.loyalty_accounts; v_pts int; v_have int;
begin
  if v_uid is null then return jsonb_build_object('success', false, 'message', 'Auth required'); end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('success', false, 'message', 'Order not found'); end if;
  if not ((v_order.created_by_id = v_uid) or (v_order.customer_email = v_email)) and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;
  if not v_order.rewards_managed then
    return public._award_loyalty_points_legacy(p_order_id);
  end if;
  if v_order.rewards_released_at is not null or v_order.loyalty_awarded then
    return jsonb_build_object('success', true, 'awarded', 0, 'message', 'already awarded');
  end if;
  if v_order.status in ('cancelled','returned','return_approved','failed_delivery') then
    return jsonb_build_object('success', true, 'awarded', 0, 'message', 'order not eligible');
  end if;
  v_pts := public._order_final_points(p_order_id);
  v_have := greatest(0, coalesce(v_order.loyalty_pending_points, 0));
  if v_pts <> v_have and v_order.created_by_id is not null then
    v_wallet := public.get_or_create_wallet(p_user_id => v_order.created_by_id, p_user_email => v_order.customer_email,
      p_user_name => v_order.customer_name, p_user_phone => v_order.phone);
    if coalesce(v_wallet.status, 'active') = 'active' then
      perform public.loyalty_set_pending(v_wallet.id, v_pts - v_have);
      update public.orders set loyalty_pending_points = v_pts, updated_date = now() where id = p_order_id;
    end if;
  end if;
  return jsonb_build_object('success', true, 'awarded', 0, 'pending', v_pts, 'message', 'pending until return window closes');
exception when others then return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.award_loyalty_points(uuid) from public, anon;
grant execute on function public.award_loyalty_points(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. compute_wheel_state: purchase spins count only released managed orders,
--    on retained value; exposes pending spins + return-hold flag.
--    (Everything else is unchanged from 0010.)
-- ---------------------------------------------------------------------------
create or replace function public.compute_wheel_state(p_user_id uuid, p_user_email text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_config public.wheel_config;
  v_now timestamptz := now();
  v_min numeric;
  v_eligible numeric := 0;
  v_earned int := 0;
  v_progress public.wheel_progress;
  v_used int;
  v_available int;
  v_progress_pct int;
  v_remaining numeric;
  v_res numeric[];
  v_all numeric[];
  v_pending_spins int := 0;
  v_hold boolean := false;
begin
  select * into v_config from public.wheel_config where active = true order by created_date desc limit 1;
  if v_config.id is null then
    return jsonb_build_object('active', false);
  end if;
  if v_config.start_date is not null and v_now < v_config.start_date then
    return jsonb_build_object('active', false, 'config', to_jsonb(v_config), 'pending', true);
  end if;
  if v_config.end_date is not null and v_now > v_config.end_date then
    return jsonb_build_object('active', false, 'config', to_jsonb(v_config), 'expired', true);
  end if;

  if p_user_id is not null then perform public._release_due_rewards(p_user_id); end if;

  v_min := coalesce(v_config.min_amount, 0);
  v_res := public._wheel_purchase(p_user_id, v_config, false, null);
  v_eligible := v_res[1];
  v_earned := v_res[2]::int;
  v_all := public._wheel_purchase(p_user_id, v_config, true, null);
  v_pending_spins := greatest(0, (v_all[2] - v_res[2])::int);
  select exists (select 1 from public.orders o where o.created_by_id = p_user_id and o.rewards_managed
    and o.rewards_released_at is null and public._active_return_exists(o.id)) into v_hold;

  v_progress := public.get_or_create_wheel_progress(p_user_id, p_user_email);
  if v_progress.free_spin_granted then v_earned := v_earned + 1; end if;

  select count(*) into v_used from public.wheel_spins where user_email = p_user_email;
  v_available := greatest(0, v_earned - v_used);
  v_progress_pct := case when v_min > 0 then least(100, round((v_eligible - v_min * floor(v_eligible / v_min)) / v_min * 100)::int) else 100 end;
  v_remaining := case when v_min > 0 then greatest(0, v_min - (v_eligible - v_min * floor(v_eligible / v_min))) else 0 end;

  return jsonb_build_object(
    'active', true, 'config', to_jsonb(v_config), 'progress', to_jsonb(v_progress),
    'eligible_amount', v_eligible, 'min_amount', v_min, 'earned', v_earned, 'used', v_used,
    'available', v_available, 'progress_pct', v_progress_pct, 'remaining_amount', v_remaining,
    'pending_spins', v_pending_spins, 'return_hold', v_hold
  );
end;
$$;
revoke execute on function public.compute_wheel_state(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Customer summary + Admin early release
-- ---------------------------------------------------------------------------
create or replace function public.my_pending_rewards()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_pts int := 0; v_hold boolean; v_next timestamptz;
begin
  if v_uid is null then return jsonb_build_object('pending_points', 0, 'return_hold', false); end if;
  perform public._release_due_rewards(v_uid);
  select coalesce(sum(public._order_final_points(o.id)), 0)::int, min(o.rewards_release_at)
    into v_pts, v_next
  from public.orders o
  where o.created_by_id = v_uid and o.rewards_managed and o.rewards_released_at is null
    and o.rewards_release_at is not null and o.status = 'delivered';
  select exists (select 1 from public.orders o where o.created_by_id = v_uid and o.rewards_managed
    and o.rewards_released_at is null and public._active_return_exists(o.id)) into v_hold;
  return jsonb_build_object('pending_points', v_pts, 'return_hold', v_hold, 'next_release_at', v_next);
end;
$$;
revoke execute on function public.my_pending_rewards() from public, anon;
grant execute on function public.my_pending_rewards() to authenticated;

create or replace function public.order_rewards_preview(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders; v_reason text;
begin
  if not (is_admin() or public.has_permission('orders.manage') or public.has_permission('loyalty.add')) then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then return jsonb_build_object('success', false, 'message', 'Order not found'); end if;
  if not v_order.rewards_managed then return jsonb_build_object('success', true, 'applicable', false); end if;
  v_reason := case
    when v_order.rewards_released_at is not null then 'released'
    when v_order.rewards_release_at is null or v_order.status <> 'delivered' then 'not_delivered'
    when public._active_return_exists(p_order_id) then 'return_hold'
    else null end;
  return jsonb_build_object('success', true, 'applicable', true,
    'points', public._order_final_points(p_order_id), 'spins', public._order_spin_delta(p_order_id),
    'release_at', v_order.rewards_release_at, 'released_at', v_order.rewards_released_at,
    'released_early', v_order.rewards_released_early, 'review_needed', v_order.rewards_review_needed,
    'can_release', v_reason is null, 'blocked_reason', v_reason);
end;
$$;
revoke execute on function public.order_rewards_preview(uuid) from public, anon;
grant execute on function public.order_rewards_preview(uuid) to authenticated;

create or replace function public.admin_release_rewards_now(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb;
begin
  if not (is_admin() or public.has_permission('orders.manage') or public.has_permission('loyalty.add')) then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;
  v_res := public._release_order_rewards(p_order_id, coalesce(auth.jwt() ->> 'email', 'admin'), true, auth.uid());
  if (v_res->>'released')::boolean then
    return jsonb_build_object('success', true, 'points', v_res->'points', 'spins', v_res->'spins');
  end if;
  return jsonb_build_object('success', false, 'message', coalesce(v_res->>'reason', 'not released'));
end;
$$;
revoke execute on function public.admin_release_rewards_now(uuid) from public, anon;
grant execute on function public.admin_release_rewards_now(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Scheduler: hourly pg_cron sweep (lazy sweep in compute_wheel_state covers
--    the gaps). Skipped silently if the extension cannot be enabled.
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('release-due-purchase-rewards', '7 * * * *', 'select public._release_due_rewards(null)');
exception when others then
  raise notice 'pg_cron unavailable (%); relying on lazy sweep', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Lazy release on balance read (redeem already spends only `balance`, which
--    never includes pending points).
-- ---------------------------------------------------------------------------
alter function public.get_loyalty_balance(numeric, numeric, numeric, integer) rename to _get_loyalty_balance_base;
revoke execute on function public._get_loyalty_balance_base(numeric, numeric, numeric, integer) from public, anon, authenticated;

create or replace function public.get_loyalty_balance(p_subtotal numeric default 0, p_delivery_cost numeric default 0,
  p_discount_amount numeric default 0, p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then perform public._release_due_rewards(auth.uid()); end if;
  return public._get_loyalty_balance_base(p_subtotal, p_delivery_cost, p_discount_amount, p_limit);
end;
$$;
revoke execute on function public.get_loyalty_balance(numeric, numeric, numeric, integer) from public, anon;
grant execute on function public.get_loyalty_balance(numeric, numeric, numeric, integer) to authenticated;
