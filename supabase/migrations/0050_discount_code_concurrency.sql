-- P1: close the discount-code usage_limit race.
--
-- Root cause: _secure_order_base validated `used_count < usage_limit` with a plain
-- SELECT (no lock) while the counter is only incremented later, in a separate
-- transaction, by redeem_discount -- which incremented unconditionally with no
-- limit re-check and no lock on the code row. Two orders using a code with one
-- remaining use both passed validation and both incremented it.
--
-- Fix (locking strategy):
--   1. _secure_order_base now locks the discount_codes row (SELECT ... FOR UPDATE)
--      before validating. Concurrent secure_order calls for the same code
--      therefore serialize on that row until each transaction commits.
--   2. Inside that lock the limit check counts, besides used_count, the *pending*
--      uses: other orders already secured with this code that redeem_discount has
--      not counted yet (discount_counted = false), that are not cancelled, and
--      that are either stock-committed or younger than 15 minutes (so an
--      abandoned, never-committed order cannot hold a use forever). A code
--      whose remaining capacity is already reserved is treated exactly like any
--      other invalid code: the order is priced without the discount.
--   3. redeem_discount locks the code row (after the order row -- same lock order
--      as secure_order, so no deadlock) and refuses to increment past
--      usage_limit, so used_count can never exceed usage_limit even for legacy or
--      expired-reservation orders. The idempotent discount_counted shortcut is
--      unchanged.
-- Everything else (pricing, dates, min_subtotal, owner_email, percent/fixed math,
-- guest handling, retries) is byte-for-byte the previous behavior.

create or replace function public._secure_order_base(p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_is_owner boolean;
  v_item jsonb;
  v_new_items jsonb := '[]'::jsonb;
  v_unit numeric;
  v_qty int;
  v_subtotal numeric := 0;
  v_delivery numeric := 0;
  v_discount_code text;
  v_discount_amount numeric := 0;
  v_dc public.discount_codes;
  v_dc_pending int := 0;
  v_loyalty_points int;
  v_loyalty_discount numeric := 0;
  v_total numeric;
  v_cat_pct numeric;
  v_product public.products;
  v_bundle public.bundles;
  v_variant jsonb;
  v_bundle_component_total numeric;
  v_redeem_rate numeric; v_max_pct numeric; v_max_val numeric; v_redeem_delivery boolean;
  v_base numeric; v_cap numeric;
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

  if v_order.secured then
    return jsonb_build_object('success', true, 'secured', true, 'order', to_jsonb(v_order));
  end if;

  for v_item in select * from jsonb_array_elements(v_order.items)
  loop
    v_qty := greatest(1, trunc(coalesce((v_item->>'qty')::numeric, 1))::int);
    v_unit := coalesce((v_item->>'price')::numeric, 0);
    v_cat_pct := 0;

    if coalesce((v_item->>'is_wheel_reward')::boolean, false) then
      v_unit := 0;
      v_qty := 1; -- a free wheel reward line is always exactly 1
    elsif coalesce((v_item->>'is_bundle')::boolean, false) then
      if (v_item->>'bundle_id') is null then
        return jsonb_build_object('success', false, 'message', 'This bundle is no longer available');
      end if;

      select * into v_bundle from public.bundles where id = (v_item->>'bundle_id')::uuid;
      if not found
         or v_bundle.active is not true
         or (v_bundle.start_date is not null and current_date < v_bundle.start_date)
         or (v_bundle.end_date is not null and current_date > v_bundle.end_date)
      then
        return jsonb_build_object('success', false, 'message', 'This bundle is no longer available');
      end if;

      if v_bundle.bundle_price is not null and v_bundle.bundle_price > 0 then
        v_unit := v_bundle.bundle_price;
      else
        select coalesce(sum(coalesce((bi->>'unit_price')::numeric, 0) * greatest(1, trunc(coalesce((bi->>'quantity')::numeric, 1))::int)), 0)
          into v_bundle_component_total
        from jsonb_array_elements(coalesce(v_bundle.items, '[]'::jsonb)) bi;
        v_unit := round(v_bundle_component_total * (1 - (greatest(0, least(100, coalesce(v_bundle.discount_percent, 0))) / 100)), 2);
      end if;
    elsif (v_item->>'id') is not null then
      select * into v_product from public.products where id = (v_item->>'id')::uuid;
      if found then
        select coalesce(c.discount_percent, 0) into v_cat_pct
        from public.categories c where c.name = v_product.category and c.discount_active is true
        limit 1;
        v_cat_pct := coalesce(v_cat_pct, 0);

        v_variant := null;
        if (v_item->>'variant_key') is not null and v_product.variants is not null then
          select elem into v_variant from jsonb_array_elements(v_product.variants) elem
          where elem->>'key' = v_item->>'variant_key' limit 1;
        end if;

        if v_variant is not null and (v_variant->>'price') is not null and (v_variant->>'price') <> '' then
          v_unit := (v_variant->>'price')::numeric;
        elsif v_product.sale_price is not null and v_product.sale_price < v_product.price then
          v_unit := v_product.sale_price;
        elsif v_cat_pct > 0 then
          v_unit := round(v_product.price * (1 - v_cat_pct / 100), 2);
        else
          v_unit := v_product.price;
        end if;
      end if;
    end if;

    v_subtotal := v_subtotal + (v_unit * v_qty);
    v_new_items := v_new_items || jsonb_build_array(v_item || jsonb_build_object('price', round(v_unit, 2), 'qty', v_qty));
  end loop;
  v_subtotal := round(v_subtotal, 2);

  if v_order.city is not null then
    select price into v_delivery from public.delivery_cities where name = v_order.city and active is true limit 1;
    v_delivery := round(coalesce(v_delivery, v_order.delivery_cost, 0), 2);
  end if;

  v_discount_code := coalesce(v_order.discount_code, '');
  v_discount_amount := 0;
  if v_discount_code <> '' then
    -- Row lock: serializes concurrent orders on the same code until commit.
    select * into v_dc from public.discount_codes where code = v_discount_code limit 1 for update;
    if found and v_dc.usage_limit is not null then
      -- Uses already reserved by other secured-but-not-yet-counted orders.
      select count(*) into v_dc_pending
      from public.orders o
      where o.discount_code = v_dc.code
        and o.id <> p_order_id
        and o.secured
        and not coalesce(o.discount_counted, false)
        and o.status <> 'cancelled'
        and (o.stock_committed or o.created_date > now() - interval '15 minutes');
    end if;
    if found
       and v_dc.active is true
       and (v_dc.expires_at is null or v_dc.expires_at >= current_date)
       and (v_dc.usage_limit is null or coalesce(v_dc.used_count, 0) + v_dc_pending < v_dc.usage_limit)
       and v_subtotal >= coalesce(v_dc.min_subtotal, 0)
       and (v_dc.owner_email is null or v_dc.owner_email = v_order.customer_email)
    then
      v_discount_amount := case when v_dc.type = 'percent' then round(v_subtotal * v_dc.value / 100, 0) else coalesce(v_dc.value, 0) end;
      if v_discount_amount > v_subtotal then v_discount_amount := v_subtotal; end if;
      v_discount_amount := round(v_discount_amount, 2);
    else
      v_discount_code := '';
    end if;
  end if;

  select coalesce(max(value) filter (where key = 'loyalty_redeem_rate'), 0.1) into v_redeem_rate from public.settings;
  select coalesce(max(value) filter (where key = 'loyalty_max_redeem_percent'), 100) into v_max_pct from public.settings;
  select coalesce(max(value) filter (where key = 'loyalty_max_redeem_value'), 0) into v_max_val from public.settings;
  select coalesce(max(value) filter (where key = 'loyalty_redeem_delivery'), 0) <> 0 into v_redeem_delivery from public.settings;
  if v_redeem_rate is null or v_redeem_rate = 0 then v_redeem_rate := 0.1; end if;

  v_loyalty_points := greatest(0, trunc(coalesce(v_order.loyalty_points, 0))::int);
  v_loyalty_discount := 0;
  if v_loyalty_points > 0 then
    v_base := v_subtotal - v_discount_amount;
    if v_redeem_delivery then v_base := v_base + v_delivery; end if;
    if v_base > 0 then
      v_cap := v_base * (coalesce(v_max_pct, 100) / 100);
      if coalesce(v_max_val, 0) > 0 then v_cap := least(v_cap, v_max_val); end if;
      v_cap := least(v_cap, v_base);
      v_loyalty_points := least(v_loyalty_points, floor(v_cap / v_redeem_rate)::int);
      v_loyalty_discount := least(round(v_loyalty_points * v_redeem_rate, 2), round(v_cap, 2));
    else
      v_loyalty_points := 0;
    end if;
  end if;

  v_total := greatest(0, round(v_subtotal + v_delivery - v_discount_amount - v_loyalty_discount, 2));

  update public.orders set
    items = v_new_items,
    subtotal = v_subtotal,
    delivery_cost = v_delivery,
    discount_code = nullif(v_discount_code, ''),
    discount_amount = v_discount_amount,
    loyalty_points = v_loyalty_points,
    loyalty_discount = v_loyalty_discount,
    total = v_total,
    secured = true,
    updated_date = now()
  where id = p_order_id
  returning * into v_order;

  return jsonb_build_object('success', true, 'order', to_jsonb(v_order));
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$function$;

create or replace function public.redeem_discount(p_code_id uuid, p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- Lock the code row (order row is already locked above: same order as
  -- _secure_order_base) so the limit check and the increment are atomic.
  select * into v_dc from public.discount_codes where id = p_code_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Code not found');
  end if;

  -- null-safe comparison so a null order.discount_code (secure_order already
  -- invalidated/cleared it) is rejected exactly like a real mismatch.
  if v_order.discount_code is distinct from v_dc.code then
    return jsonb_build_object('success', false, 'message', 'Code not applied to this order');
  end if;

  if v_dc.owner_email is not null and v_order.customer_email <> v_dc.owner_email and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'This code belongs to another customer');
  end if;

  if v_order.discount_counted then
    return jsonb_build_object('success', true, 'message', 'already counted');
  end if;

  -- used_count may never exceed usage_limit.
  if v_dc.usage_limit is not null and coalesce(v_dc.used_count, 0) >= v_dc.usage_limit then
    return jsonb_build_object('success', false, 'message', 'Usage limit reached');
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
$function$;
