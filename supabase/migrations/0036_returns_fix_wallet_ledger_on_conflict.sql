-- Fix: post_wallet_ledger() and admin_confirm_return_settlement()'s refund
-- insert both used `on conflict (idempotency_key) do nothing` against a
-- PARTIAL unique index (`where idempotency_key is not null`) -- Postgres
-- requires an ON CONFLICT target to name the same predicate as the index it
-- matches, so the bare column-list form never matched and every call
-- raised 42P10 ("no unique or exclusion constraint matching"). Adding the
-- matching `where idempotency_key is not null` to each ON CONFLICT clause
-- fixes this; nothing else about either function changes.

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
    on conflict (idempotency_key) where idempotency_key is not null do nothing
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
        on conflict (idempotency_key) where idempotency_key is not null do nothing
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
