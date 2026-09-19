-- Exchange price difference: besides paying from the wallet, the customer may
-- choose to pay it in cash when the replacement is delivered. The settlement is
-- NOT completed (and rewards are not reconciled) until an admin confirms the
-- cash was actually collected.
alter table public.return_settlements drop constraint if exists return_settlements_exchange_difference_status_check;
alter table public.return_settlements add constraint return_settlements_exchange_difference_status_check
  check (exchange_difference_status is null or exchange_difference_status in ('due', 'cod_pending', 'owed_to_customer', 'settled'));

create or replace function public.customer_choose_exchange_cash_on_delivery(p_settlement_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_s public.return_settlements;
begin
  if v_uid is null then return jsonb_build_object('success', false, 'message', 'Auth required'); end if;
  select * into v_s from public.return_settlements where id = p_settlement_id for update;
  if not found or v_s.created_by_id <> v_uid then return jsonb_build_object('success', false, 'message', 'Settlement not found'); end if;
  if v_s.request_type <> 'exchange' or v_s.status <> 'confirmed' or v_s.exchange_difference_status <> 'due' then
    return jsonb_build_object('success', false, 'message', 'No payment is currently due for this exchange');
  end if;
  update public.return_settlements set exchange_difference_status = 'cod_pending' where id = p_settlement_id;
  update public.return_requests set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'at', now(), 'action', 'EXCHANGE_DIFFERENCE_COD_SELECTED', 'from', '', 'to', '', 'by', coalesce(auth.jwt() ->> 'email', ''), 'note', ''))
    where id = v_s.return_request_id;
  return jsonb_build_object('success', true);
end;
$$;
revoke execute on function public.customer_choose_exchange_cash_on_delivery(uuid) from public, anon;
grant execute on function public.customer_choose_exchange_cash_on_delivery(uuid) to authenticated;

create or replace function public.admin_confirm_exchange_cash_collected(p_settlement_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s public.return_settlements;
begin
  if not public.has_permission('returns.settle') then return jsonb_build_object('success', false, 'message', 'Not authorized'); end if;
  select * into v_s from public.return_settlements where id = p_settlement_id for update;
  if not found then return jsonb_build_object('success', false, 'message', 'Settlement not found'); end if;
  if v_s.status <> 'confirmed' or v_s.exchange_difference_status <> 'cod_pending' then
    return jsonb_build_object('success', false, 'message', 'stale', 'current_status', v_s.status);
  end if;
  update public.return_settlements set exchange_difference_status = 'settled', status = 'completed' where id = p_settlement_id;
  update public.return_requests set status = 'completed' where id = v_s.return_request_id;
  update public.return_requests set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'at', now(), 'action', 'EXCHANGE_DIFFERENCE_CASH_COLLECTED', 'from', '', 'to', '', 'by', coalesce(auth.jwt() ->> 'email', ''), 'note', ''))
    where id = v_s.return_request_id;
  return jsonb_build_object('success', true);
end;
$$;
revoke execute on function public.admin_confirm_exchange_cash_collected(uuid) from public, anon;
grant execute on function public.admin_confirm_exchange_cash_collected(uuid) to authenticated;
