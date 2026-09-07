-- Product Draft / Preview / Publish workflow.
--
-- Adds a stable, internal `status` ('draft' | 'published') to products, with
-- every existing row backfilled to 'published' via the column default (no
-- existing product silently disappears). Also relaxes `image_url` to nullable
-- so an intentionally-incomplete draft (no image chosen yet) can be saved
-- without inventing a placeholder value — every place that renders a
-- product image (the <Image> component, ProductGallery) already falls back
-- gracefully when image_url is empty/null.
--
-- The single existing `products_public_read` policy (`using (true)`, from
-- the RLS bucket loop in 0001_init.sql) is replaced with a status-aware
-- version. This is the ONE place public product visibility is enforced —
-- every read path (the shopProducts edge function aside, which uses the
-- service-role key and is patched separately in the same deploy), the
-- storefront's direct db.Product.get()/list() calls, and Realtime broadcasts
-- (RLS applies to Realtime identically — see 0012_products_realtime.sql)
-- all inherit it automatically. Admins (is_admin()) keep seeing everything,
-- including drafts, with no separate permission needed.

alter table public.products
  add column status text not null default 'published' check (status in ('draft', 'published')),
  add column published_at timestamptz;

update public.products set published_at = created_date where status = 'published';

alter table public.products alter column image_url drop not null;

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (status = 'published' or public.is_admin());

-- Extend the existing stock-commit authority to also treat an unpublished
-- product as unavailable, reusing 100% of its existing "insufficient stock"
-- reporting path (which already cancels the order and reports {available:0}
-- for any product not found in `_locked`) — a single added condition on the
-- product-loading query, everything downstream (order cancellation, the
-- frontend's adjustForInsufficient handling) is unchanged.
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

  -- A product no longer 'published' (unpublished after being added to a
  -- cart, or a draft somehow referenced) is excluded here, so it falls
  -- through to the "not found" branch below exactly like a deleted product —
  -- reported as insufficient/unavailable rather than silently sold.
  insert into _locked (product_id, stock, variants)
  select p.id, p.stock, p.variants
  from public.products p
  where p.id in (select distinct product_id from _needed)
    and p.status = 'published'
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
