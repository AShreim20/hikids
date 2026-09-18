-- Fix: calculate_return_settlement() was subtracting the loyalty-discount
-- allocation from the eligible merchandise value itself, when the spec
-- (section 40) is clear that loyalty_discount is a PAYMENT SOURCE, not a
-- price reduction like discount_amount -- the customer's eligible value is
-- the full historical line value net of the actual COUPON/order discount
-- only; the loyalty-funded portion of THAT full value is then restored as
-- points instead of cash, not subtracted from what the customer is owed.
-- Verified against the spec's own worked example: eligible 100 (70 cash +
-- 30 points), not 70. Only the `v_net_unit_value` line changes -- discount
-- allocation, points allocation, and everything else in the function is
-- unchanged.

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

    -- Eligible value nets out the actual coupon/order discount only --
    -- loyalty_discount is a payment source, not a price reduction (section
    -- 39/40), so it is never subtracted here.
    v_net_unit_value := (v_line_value - v_alloc_discount) / v_item.purchased_quantity;
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
