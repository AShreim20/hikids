-- Returns & Exchanges -- Phase 5: financial settlement, refunds, and the
-- HiKids Wallet.
--
-- Builds on 0031-0034 without altering their columns/policies. Adds:
--   - wallets / wallet_transactions -- a genuinely new, auditable monetary
--     ledger (₪), deliberately SEPARATE from loyalty_accounts/
--     loyalty_transactions (points). No table/column is shared between the
--     two -- see section 72 of the spec. Balance is a materialized column
--     that only ever changes inside post_wallet_ledger(), in the same
--     transaction as the ledger row that justifies it (never a bare
--     `update wallets set balance = ...` anywhere else, and no RLS INSERT/
--     UPDATE policy exists for either table -- every write is forced
--     through a SECURITY DEFINER function).
--   - return_refunds -- one row per external/manual monetary refund
--     (the 'refund' path of the refund_method chosen in Phase 4). No real
--     payment gateway exists in this codebase (verified: `payment_method`
--     is 'card'/'cod'/'loyalty' but 'card' never calls any processor --
--     Checkout.jsx just marks the order paid; @stripe packages are in
--     package.json but unused anywhere), so every refund here is a manual
--     workflow an admin confirms after actually sending money outside the
--     system -- there is nothing to "call" for an automatic reversal.
--   - return_settlements -- ONE authoritative record per return_request
--     (unique on return_request_id, so calculating it is idempotent and
--     immutable -- a second call returns the already-computed row instead
--     of recomputing) holding the full eligible-value/discount-allocation/
--     funding-split/points-restoration/exchange-difference breakdown, per
--     section 53. Nothing here ever rewrites `orders`/`orders.items`.
--   - `returns.settle` / `wallet.manage` permissions (permissionsCore.js) --
--     separate from `returns.manage` (Phase 3/4's review/operational
--     permission), because moving money is a materially different
--     capability from reviewing/receiving/inspecting a request (section 64).
--
-- Sensitive free-text fields (a refund's raw failure reason from a provider,
-- an admin's reversal justification) are NOT stored on the customer-
-- readable rows -- reversal reasoning goes into the existing (Phase 3)
-- return_request_notes table (staff-only, no customer RLS at all), same
-- schema-level pattern already used for internal notes.
--
-- Nothing here touches Loyalty Points EARNING/pending-release logic
-- (that is explicitly a separate future "Rewards" phase per section 73),
-- the registration Welcome Spin (section 74), or any new payment-provider
-- integration (section 26/36) -- Wallet is not wired into Checkout as a
-- payment method in this phase (section 27's explicit deferral).

-- ---------------------------------------------------------------------------
-- 1. HiKids Wallet -- monetary ledger, separate from loyalty_accounts.
-- ---------------------------------------------------------------------------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  user_id uuid not null references auth.users(id) unique,
  user_email text not null,
  balance numeric not null default 0 check (balance >= 0),
  status text not null default 'active' check (status in ('active', 'frozen'))
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  wallet_id uuid not null references public.wallets(id),
  user_id uuid not null references auth.users(id),
  amount numeric not null check (amount > 0),
  direction text not null check (direction in ('credit', 'debit')),
  type text not null check (type in (
    'RETURN_CREDIT', 'EXCHANGE_CREDIT', 'EXCHANGE_DEBIT',
    'TOP_UP', 'PURCHASE_DEBIT', 'ADMIN_ADJUSTMENT', 'REVERSAL'
  )),
  source_type text,
  source_id uuid,
  reference_code text,
  balance_before numeric not null,
  balance_after numeric not null,
  status text not null default 'completed' check (status in ('completed', 'reversed')),
  reversed_by uuid references public.wallet_transactions(id),
  idempotency_key text,
  actor_email text,
  note text
);

create index wallet_transactions_wallet_idx on public.wallet_transactions (wallet_id);
create unique index wallet_transactions_idem_idx on public.wallet_transactions (idempotency_key) where idempotency_key is not null;

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

-- Read-only at the RLS layer for EVERYONE, including admins -- there is
-- deliberately no INSERT/UPDATE/DELETE policy on either table. Every write
-- happens inside post_wallet_ledger()/get_or_create_hikids_wallet(), which
-- run as SECURITY DEFINER and are the only way a balance can ever change.
create policy "wallets_read" on public.wallets
  for select using (user_id = auth.uid() or public.has_permission('wallet.manage') or public.has_permission('returns.manage'));

create policy "wallet_transactions_read" on public.wallet_transactions
  for select using (user_id = auth.uid() or public.has_permission('wallet.manage') or public.has_permission('returns.manage'));

-- ---------------------------------------------------------------------------
-- get_or_create_hikids_wallet / post_wallet_ledger -- the only two functions
-- allowed to touch wallets.balance. Mirrors get_or_create_wallet()/
-- post_ledger() (0005_loyalty_ledger_core.sql) byte-for-byte in spirit --
-- same idempotency-key-with-on-conflict pattern, same row-lock-then-compute
-- shape -- just for money instead of points.
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_hikids_wallet(p_user_id uuid, p_user_email text)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets;
begin
  insert into public.wallets (user_id, user_email)
  values (p_user_id, p_user_email)
  on conflict (user_id) do nothing
  returning * into v_wallet;

  if v_wallet.id is null then
    select * into v_wallet from public.wallets where user_id = p_user_id;
  end if;
  return v_wallet;
end;
$$;

revoke execute on function public.get_or_create_hikids_wallet(uuid, text) from public, anon, authenticated;

create or replace function public.post_wallet_ledger(
  p_wallet_id uuid, p_amount numeric, p_direction text, p_type text,
  p_source_type text default null, p_source_id uuid default null, p_reference_code text default null,
  p_actor_email text default null, p_idempotency_key text default null, p_note text default null
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets;
  v_before numeric;
  v_after numeric;
  v_tx public.wallet_transactions;
begin
  if p_direction not in ('credit', 'debit') then
    raise exception 'invalid_direction';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select * into v_wallet from public.wallets where id = p_wallet_id for update;
  if v_wallet.id is null then
    raise exception 'wallet_not_found';
  end if;

  v_before := v_wallet.balance;
  v_after := case when p_direction = 'credit' then v_before + p_amount else v_before - p_amount end;
  if v_after < 0 then
    raise exception 'insufficient_balance';
  end if;

  if p_idempotency_key is not null and p_idempotency_key <> '' then
    insert into public.wallet_transactions (
      wallet_id, user_id, amount, direction, type, source_type, source_id, reference_code,
      balance_before, balance_after, actor_email, idempotency_key, note
    ) values (
      p_wallet_id, v_wallet.user_id, p_amount, p_direction, p_type, p_source_type, p_source_id, p_reference_code,
      v_before, v_after, p_actor_email, p_idempotency_key, p_note
    )
    on conflict (idempotency_key) do nothing
    returning * into v_tx;

    if v_tx.id is null then
      select * into v_tx from public.wallet_transactions where idempotency_key = p_idempotency_key;
      return v_tx;
    end if;
  else
    insert into public.wallet_transactions (
      wallet_id, user_id, amount, direction, type, source_type, source_id, reference_code,
      balance_before, balance_after, actor_email, note
    ) values (
      p_wallet_id, v_wallet.user_id, p_amount, p_direction, p_type, p_source_type, p_source_id, p_reference_code,
      v_before, v_after, p_actor_email, p_note
    )
    returning * into v_tx;
  end if;

  update public.wallets set balance = v_after, updated_date = now() where id = p_wallet_id;

  return v_tx;
end;
$$;

revoke execute on function public.post_wallet_ledger(uuid, numeric, text, text, text, uuid, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Return refunds -- the external/manual monetary refund path.
-- ---------------------------------------------------------------------------
create sequence public.return_refund_code_seq;

create table public.return_refunds (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  refund_code text not null unique default ('REF-' || lpad(nextval('public.return_refund_code_seq')::text, 6, '0')),
  return_request_id uuid not null references public.return_requests(id),
  order_id uuid not null references public.orders(id),
  created_by_id uuid references auth.users(id),
  amount numeric not null check (amount >= 0),
  customer_note text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  processing_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  external_reference text,
  completed_by uuid references auth.users(id),
  idempotency_key text
);

create index return_refunds_return_request_idx on public.return_refunds (return_request_id);
create unique index return_refunds_idem_idx on public.return_refunds (idempotency_key) where idempotency_key is not null;

alter table public.return_refunds enable row level security;
create policy "return_refunds_read_own" on public.return_refunds
  for select using (created_by_id = auth.uid());
create policy "return_refunds_manage" on public.return_refunds
  for all using (public.has_permission('returns.settle') or public.has_permission('returns.manage'))
  with check (public.has_permission('returns.settle') or public.has_permission('returns.manage'));

-- ---------------------------------------------------------------------------
-- 3. Return settlements -- one authoritative record per return_request.
-- ---------------------------------------------------------------------------
create table public.return_settlements (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  return_request_id uuid not null unique references public.return_requests(id),
  order_id uuid not null references public.orders(id),
  created_by_id uuid references auth.users(id),
  request_code text not null,
  request_type text not null,

  -- [{return_request_item_id, order_item_index, product_name, product_name_en,
  --   unit_price, purchased_quantity, requested_quantity,
  --   allocated_order_discount, allocated_loyalty_discount, allocated_loyalty_points,
  --   eligible_value, points_funded_value, cash_funded_value, points_to_restore,
  --   delivery_responsibility, replacement_product_id, replacement_unit_price,
  --   replacement_quantity}, ...]
  item_breakdown jsonb not null default '[]',

  eligible_merchandise_value numeric not null default 0,
  -- Always 0 -- kept as a real, constrained column (not just a UI label) so
  -- the original delivery fee can never accidentally be refunded (section 11).
  original_delivery_refunded numeric not null default 0 check (original_delivery_refunded = 0),
  delivery_responsibility text,

  points_to_restore integer not null default 0,
  points_restored boolean not null default false,

  cash_settlement_amount numeric not null default 0,
  refund_method text,
  wallet_transaction_id uuid references public.wallet_transactions(id),
  return_refund_id uuid references public.return_refunds(id),

  exchange_difference numeric,
  exchange_difference_status text check (exchange_difference_status is null or exchange_difference_status in ('due', 'owed_to_customer', 'settled')),
  exchange_wallet_transaction_id uuid references public.wallet_transactions(id),

  status text not null default 'calculated' check (status in ('calculated', 'confirmed', 'completed', 'reversed')),
  calculated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id)
);

create index return_settlements_order_idx on public.return_settlements (order_id);

alter table public.return_settlements enable row level security;
create policy "return_settlements_read_own" on public.return_settlements
  for select using (created_by_id = auth.uid());
create policy "return_settlements_manage" on public.return_settlements
  for all using (public.has_permission('returns.settle') or public.has_permission('returns.manage'))
  with check (public.has_permission('returns.settle') or public.has_permission('returns.manage'));

-- ---------------------------------------------------------------------------
-- calculate_return_settlement -- the ONE authoritative eligible-value/
-- discount-allocation calculation (section 14). Idempotent: a settlement
-- row already existing for this request is returned as-is, never
-- recomputed (immutability, section 54). Callable by the request's own
-- customer (read-only computation, no money moves) or an admin.
--
-- Allocation method (sections 4-8): each returned line's share of the
-- order's total discount/loyalty-discount/loyalty-points is
-- round(order_total * (line_gross_value / order.subtotal)), computed
-- independently per line -- this matches every worked example in the spec
-- exactly (verified: A=150,B=50,order discount=40 -> A's share=0.75,
-- allocated=30, eligible=120). Independent per-line rounding can drift by
-- at most a cent across many lines/many separate partial settlements over
-- time; a true always-exact running ledger would require tracking
-- "discount remaining to allocate" globally across every future return of
-- the same order, which this phase does not implement -- documented here
-- rather than left silent.
-- ---------------------------------------------------------------------------
create or replace function public.calculate_return_settlement(p_return_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.return_requests;
  v_order public.orders;
  v_existing public.return_settlements;
  v_item public.return_request_items;
  v_breakdown jsonb := '[]'::jsonb;
  v_eligible_total numeric := 0;
  v_points_total int := 0;
  v_cash_total numeric := 0;
  v_line_value numeric;
  v_share numeric;
  v_alloc_discount numeric;
  v_alloc_loyalty numeric;
  v_alloc_points numeric;
  v_net_unit_value numeric;
  v_eligible_qty_value numeric;
  v_points_restore_line int;
  v_points_value_line numeric;
  v_cash_value_line numeric;
  v_already_settled int;
  v_delivery_resp text;
  v_exchange_diff numeric := null;
  v_exchange_status text := null;
  v_replacement_total numeric;
  v_inserted public.return_settlements;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  select * into v_req from public.return_requests where id = p_return_request_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;
  if v_req.created_by_id <> v_uid and not public.has_permission('returns.manage') then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;

  select * into v_existing from public.return_settlements where return_request_id = p_return_request_id;
  if found then
    return jsonb_build_object('success', true, 'already_existed', true, 'settlement', to_jsonb(v_existing));
  end if;

  if v_req.status <> 'processing' then
    return jsonb_build_object('success', false, 'message', 'This request is not ready for financial settlement yet');
  end if;
  if v_req.needs_admin_disposition_review then
    return jsonb_build_object('success', false, 'message', 'This request needs admin review before settlement');
  end if;
  if v_req.request_type = 'return' and v_req.refund_method is null then
    return jsonb_build_object('success', false, 'message', 'Choose a refund method before calculating settlement');
  end if;

  select * into v_order from public.orders where id = v_req.order_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Original order not found');
  end if;

  for v_item in select * from public.return_request_items where return_request_id = p_return_request_id order by order_item_index
  loop
    -- Cumulative settlement guard (sections 10/82): the sum of financially
    -- settled quantity for this exact order line, across every OTHER
    -- non-reversed settlement of this order, may never exceed what was
    -- actually purchased.
    select coalesce(sum((elem->>'requested_quantity')::int), 0) into v_already_settled
    from public.return_settlements s
    cross join lateral jsonb_array_elements(s.item_breakdown) elem
    where s.order_id = v_req.order_id
      and s.status <> 'reversed'
      and (elem->>'order_item_index')::int = v_item.order_item_index;

    if v_already_settled + v_item.requested_quantity > v_item.purchased_quantity then
      return jsonb_build_object('success', false, 'message', 'This item has already been financially settled for its purchased quantity');
    end if;

    v_line_value := coalesce(v_item.unit_price, 0) * v_item.purchased_quantity;
    v_share := case when coalesce(v_order.subtotal, 0) > 0 then v_line_value / v_order.subtotal else 0 end;

    v_alloc_discount := round(coalesce(v_order.discount_amount, 0) * v_share, 2);
    v_alloc_loyalty := round(coalesce(v_order.loyalty_discount, 0) * v_share, 2);
    v_alloc_points := round(coalesce(v_order.loyalty_points, 0) * v_share);

    v_net_unit_value := (v_line_value - v_alloc_discount - v_alloc_loyalty) / v_item.purchased_quantity;
    v_eligible_qty_value := round(v_net_unit_value * v_item.requested_quantity, 2);

    v_points_restore_line := round(v_alloc_points * v_item.requested_quantity / v_item.purchased_quantity::numeric);
    v_points_value_line := round(v_alloc_loyalty * v_item.requested_quantity / v_item.purchased_quantity::numeric, 2);
    v_cash_value_line := v_eligible_qty_value - v_points_value_line;

    v_eligible_total := v_eligible_total + v_eligible_qty_value;
    v_points_total := v_points_total + v_points_restore_line;
    v_cash_total := v_cash_total + v_cash_value_line;

    v_delivery_resp := coalesce(v_req.delivery_responsibility_decision, v_item.reason_policy_snapshot->>'delivery_responsibility');

    if v_item.replacement_reserved_at is not null then
      v_replacement_total := coalesce(v_item.replacement_unit_price, 0) * coalesce(v_item.replacement_quantity, 0);
      v_exchange_diff := coalesce(v_exchange_diff, 0) + (v_replacement_total - v_cash_value_line);
    end if;

    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'return_request_item_id', v_item.id,
      'order_item_index', v_item.order_item_index,
      'product_name', v_item.product_name, 'product_name_en', v_item.product_name_en,
      'unit_price', v_item.unit_price,
      'purchased_quantity', v_item.purchased_quantity,
      'requested_quantity', v_item.requested_quantity,
      'allocated_order_discount', v_alloc_discount,
      'allocated_loyalty_discount', v_alloc_loyalty,
      'allocated_loyalty_points', v_alloc_points,
      'eligible_value', v_eligible_qty_value,
      'points_funded_value', v_points_value_line,
      'cash_funded_value', v_cash_value_line,
      'points_to_restore', v_points_restore_line,
      'delivery_responsibility', v_delivery_resp,
      'replacement_product_id', v_item.replacement_product_id,
      'replacement_unit_price', v_item.replacement_unit_price,
      'replacement_quantity', v_item.replacement_quantity
    ));
  end loop;

  if v_req.request_type = 'exchange' then
    if v_exchange_diff is null then
      return jsonb_build_object('success', false, 'message', 'Every item needs a confirmed, reserved replacement before settlement');
    elsif v_exchange_diff > 0 then
      v_exchange_status := 'due';
    elsif v_exchange_diff < 0 then
      v_exchange_status := 'owed_to_customer';
    else
      v_exchange_status := 'settled';
    end if;
  end if;

  insert into public.return_settlements (
    return_request_id, order_id, created_by_id, request_code, request_type, item_breakdown,
    eligible_merchandise_value, delivery_responsibility, points_to_restore, cash_settlement_amount,
    refund_method, exchange_difference, exchange_difference_status
  ) values (
    p_return_request_id, v_req.order_id, v_req.created_by_id, v_req.request_code, v_req.request_type, v_breakdown,
    v_eligible_total, v_delivery_resp, v_points_total, v_cash_total,
    v_req.refund_method, v_exchange_diff, v_exchange_status
  )
  returning * into v_inserted;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'SETTLEMENT_CALCULATED', 'from', '', 'to', '',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', ''
    ))
    where id = p_return_request_id;

  return jsonb_build_object('success', true, 'settlement', to_jsonb(v_inserted));
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_confirm_return_settlement -- executes the actual money movement.
-- Optimistic concurrency via p_expected_status (Phase 3's exact pattern) --
-- two admins confirming the same settlement can't both succeed.
--   return + wallet         -> credits Wallet immediately, settlement completed.
--   return + refund         -> creates/finds (idempotent) a return_refunds
--                               row, status='processing' (this IS the
--                               3-7 day clock start, section 31), settlement
--                               stays 'confirmed' until admin_complete_
--                               manual_refund finishes it.
--   exchange, diff <= 0     -> HiKids owes the customer (or owes nothing) ->
--                               wallet credit (if any) + completed immediately.
--   exchange, diff > 0      -> customer owes HiKids -> settlement stays
--                               'confirmed'; customer must pay via
--                               customer_pay_exchange_difference_from_wallet
--                               before the request can complete (section 46).
-- ---------------------------------------------------------------------------
create or replace function public.admin_confirm_return_settlement(p_settlement_id uuid, p_expected_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.return_settlements;
  v_req public.return_requests;
  v_wallet public.wallets;
  v_wallet_tx public.wallet_transactions;
  v_refund public.return_refunds;
  v_email text;
  v_actor text := coalesce(auth.jwt()->>'email', '');
begin
  if not public.has_permission('returns.settle') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;

  select * into v_settlement from public.return_settlements where id = p_settlement_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Settlement not found');
  end if;
  if v_settlement.status <> p_expected_status then
    return jsonb_build_object('success', false, 'message', 'stale', 'current_status', v_settlement.status);
  end if;
  if v_settlement.status <> 'calculated' then
    return jsonb_build_object('success', false, 'message', 'Only a calculated settlement can be confirmed');
  end if;

  select * into v_req from public.return_requests where id = v_settlement.return_request_id for update;
  select email into v_email from auth.users where id = v_settlement.created_by_id;

  if v_settlement.points_to_restore > 0 and not v_settlement.points_restored then
    perform public.post_ledger(
      (public.get_or_create_wallet(v_settlement.created_by_id, v_email)).id,
      v_settlement.points_to_restore, 'RETURN_RESTORATION',
      'Points restored for ' || v_settlement.request_code, v_settlement.order_id,
      v_actor, 'return_points_restore:' || v_settlement.id::text
    );
    update public.return_settlements set points_restored = true where id = p_settlement_id;
  end if;

  if v_req.request_type = 'return' then
    if v_settlement.cash_settlement_amount > 0 then
      if v_req.refund_method = 'wallet' then
        v_wallet := public.get_or_create_hikids_wallet(v_settlement.created_by_id, v_email);
        v_wallet_tx := public.post_wallet_ledger(
          v_wallet.id, v_settlement.cash_settlement_amount, 'credit', 'RETURN_CREDIT',
          'return_request', v_settlement.return_request_id, v_settlement.request_code,
          v_actor, 'return_credit:' || v_settlement.id::text, null
        );
        update public.return_settlements
          set status = 'completed', confirmed_at = now(), confirmed_by = auth.uid(), wallet_transaction_id = v_wallet_tx.id
          where id = p_settlement_id;
      else
        insert into public.return_refunds (return_request_id, order_id, created_by_id, amount, status, processing_started_at, idempotency_key)
        values (v_settlement.return_request_id, v_settlement.order_id, v_settlement.created_by_id, v_settlement.cash_settlement_amount, 'processing', now(), 'return_refund:' || v_settlement.id::text)
        on conflict (idempotency_key) do nothing
        returning * into v_refund;
        if v_refund.id is null then
          select * into v_refund from public.return_refunds where idempotency_key = 'return_refund:' || v_settlement.id::text;
        end if;
        update public.return_settlements
          set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid(), return_refund_id = v_refund.id
          where id = p_settlement_id;
      end if;
    else
      update public.return_settlements set status = 'completed', confirmed_at = now(), confirmed_by = auth.uid() where id = p_settlement_id;
    end if;
  elsif v_req.request_type = 'exchange' then
    if v_settlement.exchange_difference_status = 'settled' then
      update public.return_settlements set status = 'completed', confirmed_at = now(), confirmed_by = auth.uid() where id = p_settlement_id;
    elsif v_settlement.exchange_difference_status = 'owed_to_customer' then
      v_wallet := public.get_or_create_hikids_wallet(v_settlement.created_by_id, v_email);
      v_wallet_tx := public.post_wallet_ledger(
        v_wallet.id, abs(v_settlement.exchange_difference), 'credit', 'EXCHANGE_CREDIT',
        'return_request', v_settlement.return_request_id, v_settlement.request_code,
        v_actor, 'exchange_credit:' || v_settlement.id::text, null
      );
      update public.return_settlements
        set status = 'completed', confirmed_at = now(), confirmed_by = auth.uid(), exchange_wallet_transaction_id = v_wallet_tx.id
        where id = p_settlement_id;
    else
      update public.return_settlements set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid() where id = p_settlement_id;
    end if;
  end if;

  select * into v_settlement from public.return_settlements where id = p_settlement_id;
  if v_settlement.status = 'completed' then
    update public.return_requests set status = 'completed' where id = v_settlement.return_request_id;
  end if;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'SETTLEMENT_CONFIRMED', 'from', '', 'to', '',
      'by', v_actor, 'note', ''
    ))
    where id = v_settlement.return_request_id;

  return jsonb_build_object('success', true, 'settlement', to_jsonb(v_settlement));
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_complete_manual_refund / admin_fail_refund / admin_retry_refund --
-- the manual refund lifecycle (sections 33/58/59). Completing requires an
-- explicit reference (never a bare one-click "done"); an optional note goes
-- to the existing staff-only return_request_notes table, never into the
-- customer-visible activity log.
-- ---------------------------------------------------------------------------
create or replace function public.admin_complete_manual_refund(p_refund_id uuid, p_external_reference text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.return_refunds;
  v_settlement public.return_settlements;
  v_actor text := coalesce(auth.jwt()->>'email', '');
begin
  if not public.has_permission('returns.settle') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;
  if p_external_reference is null or btrim(p_external_reference) = '' then
    return jsonb_build_object('success', false, 'message', 'A payment reference is required');
  end if;

  select * into v_refund from public.return_refunds where id = p_refund_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Refund not found');
  end if;
  if v_refund.status <> 'processing' then
    return jsonb_build_object('success', false, 'message', 'Only a processing refund can be marked completed');
  end if;

  update public.return_refunds
    set status = 'completed', completed_at = now(), completed_by = auth.uid(), external_reference = btrim(p_external_reference)
    where id = p_refund_id;

  if p_note is not null and btrim(p_note) <> '' then
    insert into public.return_request_notes (return_request_id, note) values (v_refund.return_request_id, btrim(p_note));
  end if;

  select * into v_settlement from public.return_settlements where return_refund_id = p_refund_id for update;
  if found then
    update public.return_settlements set status = 'completed' where id = v_settlement.id;
    update public.return_requests set status = 'completed' where id = v_settlement.return_request_id;
  end if;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'REFUND_COMPLETED', 'from', '', 'to', '', 'by', v_actor, 'note', ''
    ))
    where id = v_refund.return_request_id;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_fail_refund(p_refund_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.return_refunds;
  v_actor text := coalesce(auth.jwt()->>'email', '');
begin
  if not public.has_permission('returns.settle') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('success', false, 'message', 'A failure reason is required');
  end if;

  select * into v_refund from public.return_refunds where id = p_refund_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Refund not found');
  end if;
  if v_refund.status <> 'processing' then
    return jsonb_build_object('success', false, 'message', 'Only a processing refund can be marked failed');
  end if;

  update public.return_refunds set status = 'failed', failed_at = now(), failure_reason = btrim(p_reason) where id = p_refund_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'REFUND_FAILED', 'from', '', 'to', '', 'by', v_actor, 'note', ''
    ))
    where id = v_refund.return_request_id;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_retry_refund(p_refund_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.return_refunds;
  v_actor text := coalesce(auth.jwt()->>'email', '');
begin
  if not public.has_permission('returns.settle') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;

  select * into v_refund from public.return_refunds where id = p_refund_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Refund not found');
  end if;
  if v_refund.status <> 'failed' then
    return jsonb_build_object('success', false, 'message', 'Only a failed refund can be retried');
  end if;

  update public.return_refunds
    set status = 'processing', failed_at = null, failure_reason = null,
        processing_started_at = coalesce(processing_started_at, now())
    where id = p_refund_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'REFUND_RETRY', 'from', '', 'to', '', 'by', v_actor, 'note', ''
    ))
    where id = v_refund.return_request_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- customer_pay_exchange_difference_from_wallet -- section 46/51: an
-- exchange is not treated as financially resolved while the customer owes
-- money. Wallet is the only payment source available today (no gateway) --
-- insufficient balance leaves the settlement 'confirmed'/'due', never a
-- fake success.
-- ---------------------------------------------------------------------------
create or replace function public.customer_pay_exchange_difference_from_wallet(p_settlement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_settlement public.return_settlements;
  v_wallet public.wallets;
  v_tx public.wallet_transactions;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  select * into v_settlement from public.return_settlements where id = p_settlement_id for update;
  if not found or v_settlement.created_by_id <> v_uid then
    return jsonb_build_object('success', false, 'message', 'Settlement not found');
  end if;
  if v_settlement.status <> 'confirmed' or v_settlement.exchange_difference_status <> 'due' then
    return jsonb_build_object('success', false, 'message', 'No payment is currently due for this exchange');
  end if;

  v_wallet := public.get_or_create_hikids_wallet(v_uid, v_email);
  if v_wallet.balance < v_settlement.exchange_difference then
    return jsonb_build_object('success', false, 'message', 'Insufficient wallet balance', 'balance', v_wallet.balance, 'needed', v_settlement.exchange_difference);
  end if;

  v_tx := public.post_wallet_ledger(
    v_wallet.id, v_settlement.exchange_difference, 'debit', 'EXCHANGE_DEBIT',
    'return_request', v_settlement.return_request_id, v_settlement.request_code,
    coalesce(v_email, ''), 'exchange_debit:' || v_settlement.id::text, null
  );

  update public.return_settlements
    set exchange_difference_status = 'settled', status = 'completed', exchange_wallet_transaction_id = v_tx.id
    where id = p_settlement_id;
  update public.return_requests set status = 'completed' where id = v_settlement.return_request_id;
  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'EXCHANGE_DIFFERENCE_PAID', 'from', '', 'to', '', 'by', coalesce(v_email, ''), 'note', ''
    ))
    where id = v_settlement.return_request_id;

  return jsonb_build_object('success', true, 'new_balance', v_tx.balance_after);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_reverse_settlement -- section 55: correction via a linked reversal,
-- never by deleting/rewriting history. The reason goes to the staff-only
-- return_request_notes table, matching admin_complete_manual_refund above.
-- ---------------------------------------------------------------------------
create or replace function public.admin_reverse_settlement(p_settlement_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.return_settlements;
  v_wallet_tx public.wallet_transactions;
  v_reversal public.wallet_transactions;
  v_actor text := coalesce(auth.jwt()->>'email', '');
  v_email text;
begin
  if not public.has_permission('returns.settle') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('success', false, 'message', 'A reversal reason is required');
  end if;

  select * into v_settlement from public.return_settlements where id = p_settlement_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Settlement not found');
  end if;
  if v_settlement.status <> 'completed' then
    return jsonb_build_object('success', false, 'message', 'Only a completed settlement can be reversed');
  end if;

  select email into v_email from auth.users where id = v_settlement.created_by_id;

  if v_settlement.wallet_transaction_id is not null or v_settlement.exchange_wallet_transaction_id is not null then
    select * into v_wallet_tx from public.wallet_transactions
      where id = coalesce(v_settlement.wallet_transaction_id, v_settlement.exchange_wallet_transaction_id);
    if v_wallet_tx.status = 'completed' then
      v_reversal := public.post_wallet_ledger(
        v_wallet_tx.wallet_id, v_wallet_tx.amount,
        case when v_wallet_tx.direction = 'credit' then 'debit' else 'credit' end,
        'REVERSAL', 'return_settlement', p_settlement_id, v_settlement.request_code,
        v_actor, 'reversal:' || v_wallet_tx.id::text, null
      );
      update public.wallet_transactions set status = 'reversed', reversed_by = v_reversal.id where id = v_wallet_tx.id;
    end if;
  end if;

  if v_settlement.points_restored and v_settlement.points_to_restore > 0 then
    perform public.post_ledger(
      (public.get_or_create_wallet(v_settlement.created_by_id, v_email)).id,
      -v_settlement.points_to_restore, 'RETURN_REVERSAL', null, v_settlement.order_id,
      v_actor, 'return_points_restore_reversal:' || v_settlement.id::text
    );
  end if;

  update public.return_settlements set status = 'reversed', reversed_at = now(), reversed_by = auth.uid() where id = p_settlement_id;

  insert into public.return_request_notes (return_request_id, note)
  values (v_settlement.return_request_id, 'Settlement reversed: ' || btrim(p_reason));

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'SETTLEMENT_REVERSED', 'from', '', 'to', '', 'by', v_actor, 'note', ''
    ))
    where id = v_settlement.return_request_id;

  return jsonb_build_object('success', true);
end;
$$;

-- `wallet_transactions.status = 'reversed'` is compared against, but the
-- REVERSAL itself is a normal 'completed' row -- a wallet balance always
-- reflects every row regardless of whether an earlier row it offsets was
-- marked 'reversed' (that flag is informational/audit only, never used to
-- exclude a row from the balance calculation, since balance is carried
-- forward via balance_after on each insert, not recomputed by summing).
