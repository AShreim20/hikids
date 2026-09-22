-- User Management enhancement: richer per-user report (net purchases net of
-- completed refunds, available spins, activity extended to returns/rewards)
-- for the admin list, plus a new on-demand per-user detail RPC for the
-- "View Details" drawer (avatar/name/email/phone/role come from the already-
-- loaded profiles list on the client -- this only adds what that list can't
-- provide: email-confirmation status, pending points, live wheel state, and
-- the customer's most recent order).

create or replace function public.admin_user_reports()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'total_orders', coalesce(o.cnt, 0),
      'total_spent', coalesce(o.total, 0),
      -- Purchases net of completed return cash refunds (exchanges are a
      -- product swap, not a refund, so they're deliberately left out here).
      'net_spent', greatest(0, coalesce(o.total, 0) - coalesce(rf.refunded, 0)),
      'points_balance', coalesce(la.balance, 0),
      'wallet_balance', coalesce(w.balance, 0),
      -- Cheap, read-only approximation for the list row: stored
      -- spins_earned/free-spin flag minus spins already used. This can lag
      -- a few minutes behind a very recent qualifying order (it doesn't
      -- run the write-side "release due rewards" pass that the customer's
      -- own wheel page does) -- the drawer's admin_user_detail() call below
      -- gets the authoritative live figure via compute_wheel_state().
      'available_spins', greatest(0, coalesce(wp.spins_earned, 0)
        + case when wp.free_spin_granted then 1 else 0 end - coalesce(ws.used, 0)),
      'last_activity_at', greatest(o.last_at, rr.last_at, lt.last_at, wt.last_at, rh.last_at),
      'last_activity_type', case greatest(o.last_at, rr.last_at, lt.last_at, wt.last_at, rh.last_at)
        when o.last_at then 'order'
        when rr.last_at then 'return'
        when lt.last_at then 'loyalty'
        when wt.last_at then 'wallet'
        when rh.last_at then 'reward'
        else null end
    ))
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join (
      select created_by_id, count(*) cnt, sum(total) total, max(created_date) last_at
      from public.orders where status <> 'cancelled' group by created_by_id
    ) o on o.created_by_id = u.id
    left join (
      select ord.created_by_id, sum(rs.cash_settlement_amount) refunded
      from public.return_settlements rs
      join public.orders ord on ord.id = rs.order_id
      where rs.status = 'completed' and rs.request_type = 'return'
      group by ord.created_by_id
    ) rf on rf.created_by_id = u.id
    left join (
      select ord.created_by_id, max(rreq.submitted_at) last_at
      from public.return_requests rreq
      join public.orders ord on ord.id = rreq.order_id
      group by ord.created_by_id
    ) rr on rr.created_by_id = u.id
    left join public.loyalty_accounts la on la.user_id = u.id
    left join public.wallets w on w.user_id = u.id
    left join public.wheel_progress wp on wp.user_id = u.id
    left join (select user_email, count(*) used from public.wheel_spins group by user_email) ws on ws.user_email = p.email
    left join (select user_id, max(created_date) last_at from public.loyalty_transactions group by user_id) lt on lt.user_id = u.id
    left join (select user_id, max(created_date) last_at from public.wallet_transactions group by user_id) wt on wt.user_id = u.id
    left join (select user_id, max(created_date) last_at from public.reward_history group by user_id) rh on rh.user_id = u.id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_confirmed_at timestamptz;
  v_pending_points int;
  v_last_order jsonb;
  v_wheel jsonb;
begin
  if not is_admin() then return jsonb_build_object('success', false, 'message', 'Not authorized'); end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then return jsonb_build_object('success', false, 'message', 'User not found'); end if;

  select confirmed_at into v_confirmed_at from auth.users where id = p_user_id;
  select coalesce(pending_points, 0) into v_pending_points from public.loyalty_accounts where user_id = p_user_id;

  select jsonb_build_object('id', o.id, 'total', o.total, 'status', o.status, 'created_date', o.created_date)
    into v_last_order
    from public.orders o
    where o.created_by_id = p_user_id and o.status <> 'cancelled'
    order by o.created_date desc limit 1;

  -- Single-user, on-demand call (the drawer opens for one user at a time) --
  -- unlike the bulk list above, paying for the authoritative live
  -- computation (and its harmless idempotent "release due rewards" side
  -- effect) here is cheap and correct, exactly like the customer's own
  -- wheel page already does on every visit.
  v_wheel := public.compute_wheel_state(p_user_id, v_profile.email);

  return jsonb_build_object(
    'success', true,
    'account_confirmed_at', v_confirmed_at,
    'pending_points', coalesce(v_pending_points, 0),
    'available_spins', coalesce((v_wheel->>'available')::int, 0),
    'pending_spins', coalesce((v_wheel->>'pending_spins')::int, 0),
    'last_order', v_last_order
  );
end;
$$;
revoke execute on function public.admin_user_detail(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
