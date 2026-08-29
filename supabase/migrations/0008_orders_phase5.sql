-- Phase 5: Orders + stock. Ports secureOrder, commitOrderStock and
-- redeemDiscount from Base44 functions to atomic Postgres functions (no Edge
-- Function needed — auth.uid()/auth.jwt() inside a SECURITY DEFINER function
-- already reflect the calling user via PostgREST, exactly like an Edge
-- Function's createClientFromRequest(req) did), plus fixes the orders INSERT
-- policy to allow guest checkout and adds orders to realtime.

-- Base44's Order.rls.create was `null` (fully public — guest checkout
-- allowed). The Phase-0 policy required created_by_id = auth.uid(), which is
-- NULL for anon callers and NULL = NULL is not true in SQL, so guest orders
-- were silently rejected. Same fix pattern as reviews (0004).
drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_public on public.orders for insert with check (true);

alter publication supabase_realtime add table public.orders;

-- ── secure_order ────────────────────────────────────────────────────────
-- Server-side authority for order financials. Re-derives every line price,
-- subtotal, delivery cost, discount and loyalty discount from the real
-- database records so a forged client total can never be paid. Idempotent
-- via the `secured` flag.
create or replace function public.secure_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    elsif coalesce((v_item->>'is_bundle')::boolean, false) and (v_item->>'bundle_id') is not null then
      select * into v_bundle from public.bundles where id = (v_item->>'bundle_id')::uuid;
      if found then
        if v_bundle.bundle_price is not null and v_bundle.bundle_price > 0 then
          v_unit := v_bundle.bundle_price;
        else
          select coalesce(sum(coalesce((bi->>'unit_price')::numeric, 0) * greatest(1, trunc(coalesce((bi->>'quantity')::numeric, 1))::int)), 0)
            into v_bundle_component_total
          from jsonb_array_elements(coalesce(v_bundle.items, '[]'::jsonb)) bi;
          v_unit := round(v_bundle_component_total * (1 - (greatest(0, least(100, coalesce(v_bundle.discount_percent, 0))) / 100)), 2);
        end if;
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
    select * into v_dc from public.discount_codes where code = v_discount_code limit 1;
    if found
       and v_dc.active is true
       and (v_dc.expires_at is null or v_dc.expires_at >= current_date)
       and (v_dc.usage_limit is null or coalesce(v_dc.used_count, 0) < v_dc.usage_limit)
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
$$;

revoke execute on function public.secure_order(uuid) from public, anon;
grant execute on function public.secure_order(uuid) to authenticated;

-- ── commit_order_stock ──────────────────────────────────────────────────
-- Atomically validates and deducts stock for every line (bundle components
-- expanded, variants handled via their nested jsonb). Every touched product
-- row is locked up front (deterministic id order, avoids deadlocks) so the
-- check-then-write is race-free — strictly safer than Base44's conditional
-- $inc + rollback-on-failure approach. Idempotent via `stock_committed`.
create or replace function public.commit_order_stock(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_is_owner boolean;
  v_insufficient jsonb := '[]'::jsonb;
  v_ok boolean := true;
  v_rec record;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'Authentication required');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('error', 'Order not found');
  end if;

  v_is_owner := (v_order.created_by_id = v_uid) or (v_order.customer_email = v_email);
  if not v_is_owner and not is_admin() then
    return jsonb_build_object('error', 'Forbidden');
  end if;

  if v_order.stock_committed then
    return jsonb_build_object('success', true, 'idempotent', true);
  end if;

  create temporary table _needed (
    product_id uuid, variant_key text, qty int, name text, variant_label text
  ) on commit drop;

  insert into _needed (product_id, variant_key, qty, name, variant_label)
  select (it->>'id')::uuid, it->>'variant_key', greatest(0, trunc(coalesce((it->>'qty')::numeric, 0))::int),
         it->>'name', it->>'variant_label'
  from jsonb_array_elements(v_order.items) it
  where coalesce((it->>'is_bundle')::boolean, false) = false
    and (it->>'id') is not null
    and coalesce((it->>'qty')::numeric, 0) > 0;

  insert into _needed (product_id, variant_key, qty, name, variant_label)
  select (bi->>'product_id')::uuid, null,
         greatest(0, trunc(coalesce((it->>'qty')::numeric, 0))::int) * greatest(1, trunc(coalesce((bi->>'quantity')::numeric, 1))::int),
         coalesce(bi->>'name', it->>'name'), null
  from jsonb_array_elements(v_order.items) it
  cross join lateral jsonb_array_elements(coalesce(it->'bundle_items', '[]'::jsonb)) bi
  where coalesce((it->>'is_bundle')::boolean, false) = true
    and (bi->>'product_id') is not null
    and coalesce((it->>'qty')::numeric, 0) > 0;

  create temporary table _locked (
    product_id uuid primary key, stock int, variants jsonb
  ) on commit drop;

  insert into _locked (product_id, stock, variants)
  select p.id, p.stock, p.variants
  from public.products p
  where p.id in (select distinct product_id from _needed)
  order by p.id
  for update;

  for v_rec in
    select product_id, variant_key, sum(qty)::int as qty,
           max(name) as name, max(variant_label) as variant_label
    from _needed
    group by product_id, variant_key
  loop
    declare
      v_locked record;
      v_available int;
      v_idx int;
      v_variants jsonb;
      v_found boolean := false;
      v_elem jsonb;
      v_i int := 0;
    begin
      select * into v_locked from _locked where product_id = v_rec.product_id;
      if not found then
        v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
          'id', v_rec.product_id, 'name', coalesce(v_rec.name, 'Product'),
          'variant_key', v_rec.variant_key, 'variant_label', v_rec.variant_label,
          'available', 0, 'requested', v_rec.qty));
        v_ok := false;
        continue;
      end if;

      if v_rec.variant_key is null then
        if v_locked.stock < v_rec.qty then
          v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
            'id', v_rec.product_id, 'name', coalesce(v_rec.name, 'Product'),
            'variant_key', null, 'variant_label', v_rec.variant_label,
            'available', v_locked.stock, 'requested', v_rec.qty));
          v_ok := false;
        else
          update _locked set stock = stock - v_rec.qty where product_id = v_rec.product_id;
        end if;
      else
        v_variants := coalesce(v_locked.variants, '[]'::jsonb);
        v_available := 0;
        for v_elem in select value from jsonb_array_elements(v_variants) loop
          if v_elem->>'key' = v_rec.variant_key then
            v_available := coalesce((v_elem->>'stock')::int, 0);
            v_idx := v_i;
            v_found := true;
          end if;
          v_i := v_i + 1;
        end loop;
        if not v_found or v_available < v_rec.qty then
          v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
            'id', v_rec.product_id, 'name', coalesce(v_rec.name, 'Product'),
            'variant_key', v_rec.variant_key, 'variant_label', v_rec.variant_label,
            'available', v_available, 'requested', v_rec.qty));
          v_ok := false;
        else
          update _locked
          set variants = jsonb_set(v_variants, array[v_idx::text, 'stock'], to_jsonb(v_available - v_rec.qty))
          where product_id = v_rec.product_id;
        end if;
      end if;
    end;
  end loop;

  if not v_ok then
    update public.orders
    set status = 'cancelled',
        payment_status = case when v_order.payment_status = 'paid' then 'refunded' else v_order.payment_status end,
        updated_date = now()
    where id = p_order_id;
    return jsonb_build_object('success', false, 'insufficient', v_insufficient);
  end if;

  update public.products p
  set stock = l.stock, variants = l.variants, updated_date = now()
  from _locked l
  where p.id = l.product_id;

  update public.orders set stock_committed = true, updated_date = now() where id = p_order_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.commit_order_stock(uuid) from public, anon;
grant execute on function public.commit_order_stock(uuid) to authenticated;

-- ── redeem_discount ─────────────────────────────────────────────────────
-- Increments a code's used_count for a verified order (idempotent per
-- order), and marks the originating wheel spin (if any) as spent.
create or replace function public.redeem_discount(p_code_id uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_dc public.discount_codes;
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_is_owner boolean;
  v_spin public.wheel_spins;
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

  select * into v_dc from public.discount_codes where id = p_code_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Code not found');
  end if;

  if v_order.discount_code is not null and v_order.discount_code <> v_dc.code then
    return jsonb_build_object('success', false, 'message', 'Code mismatch');
  end if;

  if v_dc.owner_email is not null and v_order.customer_email <> v_dc.owner_email and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'This code belongs to another customer');
  end if;

  if v_order.discount_counted then
    return jsonb_build_object('success', true, 'message', 'already counted');
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
$$;

revoke execute on function public.redeem_discount(uuid, uuid) from public, anon;
grant execute on function public.redeem_discount(uuid, uuid) to authenticated;
