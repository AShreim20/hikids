-- Returns & Exchanges -- Phase 4: physical receiving, inspection, inventory
-- disposition, and resolution selection (refund method / exchange
-- replacement / missing item-part prep).
--
-- Builds on 0031-0033 without altering their columns/policies. Adds:
--   - products.reserved_stock (+ a 'reserved_stock' key inside each
--     variants[] element, defaulting to 0 when absent) -- the one addition
--     to the EXISTING inventory architecture Phase 4 genuinely needs, so an
--     exchange replacement can be held without an immediate sale (section
--     37 of the spec). commit_order_stock is re-defined with one added
--     term (stock - reserved_stock) so a reserved unit can't be sold to
--     another customer at checkout -- everything else in that function is
--     byte-for-byte the same as 0021_guest_checkout_stock_fix.sql's version
--     (the current live one; 0015's own copy was superseded by it).
--   - return_reasons.requires_undamaged_return -- mirrors delivery_
--     responsibility's existing shape: a policy flag captured into
--     reason_policy_snapshot at submission time (Phase 2), read back here
--     to decide whether a damaged/incomplete inspection result should
--     block automatic resolution (spec sections 20-22).
--   - return_request_item_receipts / return_request_item_inspections --
--     append-only, admin-only event tables (same no-customer-RLS pattern as
--     0033's return_request_notes) recording each physical receiving and
--     inspection action. An event log rather than a single mutable
--     "received_quantity" column specifically so partial/split receiving
--     and split-condition inspection (spec sections 5, 51-52) are naturally
--     supported and auditable, and so idempotency keys give real
--     double-submission protection.
--   - inventory_movements -- a new, generic (not returns-specific) ledger
--     table, since none existed anywhere in this schema (verified: neither
--     commit_order_stock nor adjust_product_stock/postPurchaseOrder write
--     one). One row per SELLABLE inspection outcome, uniquely tied to that
--     inspection row (`inspection_id unique`), which is what actually
--     prevents double-restock (spec section 16) -- not application logic
--     alone.
--   - return_requests.refund_method / refund_method_selected_at /
--     needs_admin_disposition_review -- return-type resolution.
--   - return_request_items.exchange_replacement_mode / replacement_* /
--     missing_resolution -- exchange & missing-item/part resolution, kept
--     per-item since a multi-item request can exchange each line
--     separately.
--
-- Nothing here executes a refund, wallet credit, exchange price-difference
-- charge, accounting entry, or Loyalty/Spin change -- see the RPCs below,
-- which only ever write to products.reserved_stock/stock/variants,
-- inventory_movements, and the return_request(_item*) tables.
--
-- Permission model: every RPC below reuses 'returns.manage', the same
-- single permission Phase 3 settled on -- not fragmented into separate
-- receive/inspect/disposition/reservation capabilities, matching this
-- phase's own "do not rebuild the permission system" instruction.

-- ---------------------------------------------------------------------------
-- 0. Small helper: index of a variant by key inside a product's variants[]
--    jsonb array (or null). Used everywhere a variant-aware stock/reserved-
--    stock update is needed, instead of repeating the same loop four times.
-- ---------------------------------------------------------------------------
create or replace function public._variant_index(p_variants jsonb, p_key text)
returns int
language sql
immutable
as $$
  select (elem.ord - 1)::int
  from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb)) with ordinality as elem(value, ord)
  where elem.value->>'key' = p_key
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 1. Reserved stock -- additive column, defaults to 0 so every existing
--    product/order behaves identically to before this migration. Variant
--    elements get an implicit reserved_stock of 0 when the key is absent
--    (handled via coalesce at read time everywhere below) -- no backfill
--    needed for the jsonb array.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists reserved_stock integer not null default 0 check (reserved_stock >= 0);

-- ── commit_order_stock: add "- reserved_stock" to both availability checks ─
-- Everything else here is unchanged from 0021_guest_checkout_stock_fix.sql.
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
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('error', 'Order not found');
  end if;

  if v_uid is null then
    if v_order.created_by_id is not null or v_order.created_date < now() - interval '1 hour' then
      return jsonb_build_object('error', 'Authentication required');
    end if;
  else
    v_is_owner := (v_order.created_by_id = v_uid) or (v_order.customer_email = v_email);
    if not v_is_owner and not is_admin() then
      return jsonb_build_object('error', 'Forbidden');
    end if;
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
    product_id uuid primary key, stock int, reserved_stock int, variants jsonb
  ) on commit drop;

  insert into _locked (product_id, stock, reserved_stock, variants)
  select p.id, p.stock, p.reserved_stock, p.variants
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
        if (v_locked.stock - v_locked.reserved_stock) < v_rec.qty then
          v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
            'id', v_rec.product_id, 'name', coalesce(v_rec.name, 'Product'),
            'variant_key', null, 'variant_label', v_rec.variant_label,
            'available', greatest(0, v_locked.stock - v_locked.reserved_stock), 'requested', v_rec.qty));
          v_ok := false;
        else
          update _locked set stock = stock - v_rec.qty where product_id = v_rec.product_id;
        end if;
      else
        v_variants := coalesce(v_locked.variants, '[]'::jsonb);
        v_available := 0;
        for v_elem in select value from jsonb_array_elements(v_variants) loop
          if v_elem->>'key' = v_rec.variant_key then
            v_available := coalesce((v_elem->>'stock')::int, 0) - coalesce((v_elem->>'reserved_stock')::int, 0);
            v_idx := v_i;
            v_found := true;
          end if;
          v_i := v_i + 1;
        end loop;
        if not v_found or v_available < v_rec.qty then
          v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
            'id', v_rec.product_id, 'name', coalesce(v_rec.name, 'Product'),
            'variant_key', v_rec.variant_key, 'variant_label', v_rec.variant_label,
            'available', greatest(0, v_available), 'requested', v_rec.qty));
          v_ok := false;
        else
          update _locked
          set variants = jsonb_set(v_variants, array[v_idx::text, 'stock'],
            to_jsonb(coalesce((v_variants->v_idx->>'stock')::int, 0) - v_rec.qty))
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

revoke execute on function public.commit_order_stock(uuid) from public;
grant execute on function public.commit_order_stock(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. Reason policy extension (sections 20-22): whether the product must
--    come back in acceptable condition for this reason's claim to resolve
--    automatically. Flows into reason_policy_snapshot at submission time
--    exactly like delivery_responsibility already does (0032).
-- ---------------------------------------------------------------------------
alter table public.return_reasons
  add column if not exists requires_undamaged_return boolean not null default false;

-- Known live reasons (Phase 1 seed data), set explicitly rather than
-- guessed from ids: a "changed mind" claim requires the product back in
-- acceptable condition; "arrived damaged" does not (damage is the expected
-- claim itself).
update public.return_reasons set requires_undamaged_return = true where name = 'غيرت رأيي';
update public.return_reasons set requires_undamaged_return = false where name = 'المنتج وصل مكسوراً';

-- ---------------------------------------------------------------------------
-- 3. Physical receiving events.
-- ---------------------------------------------------------------------------
create table public.return_request_item_receipts (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  return_request_item_id uuid not null references public.return_request_items(id) on delete cascade,
  received_quantity integer not null check (received_quantity > 0),
  received_by uuid references auth.users(id),
  note text,
  photos text[] not null default '{}',
  idempotency_key text
);

create index return_request_item_receipts_item_idx on public.return_request_item_receipts (return_request_item_id);
create unique index return_request_item_receipts_idem_idx on public.return_request_item_receipts (idempotency_key) where idempotency_key is not null;

alter table public.return_request_item_receipts enable row level security;
create policy "return_request_item_receipts_manage" on public.return_request_item_receipts
  for all using (public.has_permission('returns.manage'))
  with check (public.has_permission('returns.manage'));

-- ---------------------------------------------------------------------------
-- 4. Inspection events. A 'needs_inspection' row is a hold marker only --
--    it does NOT count toward the finalized total computed in the RPC
--    below, so the same units can be re-inspected later into a real final
--    condition without being double-counted (section 13).
-- ---------------------------------------------------------------------------
create table public.return_request_item_inspections (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  return_request_item_id uuid not null references public.return_request_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  condition text not null check (condition in ('sellable', 'damaged', 'incomplete', 'needs_inspection')),
  inspected_by uuid references auth.users(id),
  note text,
  photos text[] not null default '{}',
  idempotency_key text
);

create index return_request_item_inspections_item_idx on public.return_request_item_inspections (return_request_item_id);
create unique index return_request_item_inspections_idem_idx on public.return_request_item_inspections (idempotency_key) where idempotency_key is not null;

alter table public.return_request_item_inspections enable row level security;
create policy "return_request_item_inspections_manage" on public.return_request_item_inspections
  for all using (public.has_permission('returns.manage'))
  with check (public.has_permission('returns.manage'));

-- ---------------------------------------------------------------------------
-- 5. Inventory movement ledger (new -- no prior table like this existed).
--    `inspection_id` is UNIQUE: at most one movement can ever reference a
--    given inspection row, which is the actual double-restock guard
--    (section 16), not just the RPC's own control flow.
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  product_id uuid references public.products(id) on delete set null,
  variant_key text,
  delta integer not null,
  movement_type text not null check (movement_type in ('return_restock')),
  return_request_id uuid references public.return_requests(id) on delete set null,
  return_request_item_id uuid references public.return_request_items(id) on delete set null,
  inspection_id uuid unique references public.return_request_item_inspections(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references auth.users(id),
  note text
);

create index inventory_movements_product_idx on public.inventory_movements (product_id);
create index inventory_movements_return_request_idx on public.inventory_movements (return_request_id);

alter table public.inventory_movements enable row level security;
create policy "inventory_movements_manage" on public.inventory_movements
  for all using (public.has_permission('returns.manage'))
  with check (public.has_permission('returns.manage'));

-- ---------------------------------------------------------------------------
-- 6. Resolution columns.
-- ---------------------------------------------------------------------------
alter table public.return_requests
  add column if not exists refund_method text check (refund_method is null or refund_method in ('wallet', 'refund')),
  add column if not exists refund_method_selected_at timestamptz,
  add column if not exists needs_admin_disposition_review boolean not null default false;

alter table public.return_request_items
  add column if not exists exchange_replacement_mode text check (exchange_replacement_mode is null or exchange_replacement_mode in ('same_product', 'different_product')),
  add column if not exists replacement_product_id uuid references public.products(id) on delete set null,
  add column if not exists replacement_variant_key text,
  add column if not exists replacement_quantity integer check (replacement_quantity is null or replacement_quantity > 0),
  add column if not exists replacement_unit_price numeric,
  add column if not exists replacement_price_difference numeric,
  add column if not exists replacement_confirmed_at timestamptz,
  add column if not exists replacement_reserved_at timestamptz,
  add column if not exists replacement_released_at timestamptz,
  add column if not exists missing_resolution text check (missing_resolution is null or missing_resolution in ('send_missing_item', 'send_missing_part', 'full_exchange'));

-- ---------------------------------------------------------------------------
-- admin_receive_return_item -- physical receiving (section 3-6). Supports
-- partial receiving: total received is derived as
-- sum(return_request_item_receipts.received_quantity), never a mutable
-- counter, so "received 2 of 3" falls out naturally and is race-safe under
-- the row lock below.
-- ---------------------------------------------------------------------------
create or replace function public.admin_receive_return_item(
  p_request_item_id uuid, p_quantity int, p_note text default null,
  p_photos text[] default '{}', p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.return_request_items;
  v_req public.return_requests;
  v_existing public.return_request_item_receipts;
  v_total_received int;
  v_remaining int;
  v_all_received boolean;
begin
  if not public.has_permission('returns.manage') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into v_existing from public.return_request_item_receipts where idempotency_key = p_idempotency_key;
    if found then
      select * into v_item from public.return_request_items where id = v_existing.return_request_item_id;
      select * into v_req from public.return_requests where id = v_item.return_request_id;
      select coalesce(sum(received_quantity), 0) into v_total_received
        from public.return_request_item_receipts where return_request_item_id = v_item.id;
      return jsonb_build_object('success', true, 'already_existed', true,
        'received_quantity', v_existing.received_quantity,
        'remaining_quantity', greatest(0, v_item.requested_quantity - v_total_received),
        'request_status', v_req.status);
    end if;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('success', false, 'message', 'Quantity must be positive');
  end if;

  select * into v_item from public.return_request_items where id = p_request_item_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Item not found');
  end if;

  select * into v_req from public.return_requests where id = v_item.return_request_id for update;
  if v_req.status <> 'awaiting_return' then
    return jsonb_build_object('success', false, 'message', 'This request is not awaiting a physical return');
  end if;

  select coalesce(sum(received_quantity), 0) into v_total_received
    from public.return_request_item_receipts where return_request_item_id = v_item.id;
  v_remaining := v_item.requested_quantity - v_total_received;

  if p_quantity > v_remaining then
    return jsonb_build_object('success', false, 'message', 'Received quantity exceeds the remaining approved quantity', 'remaining_quantity', v_remaining);
  end if;

  insert into public.return_request_item_receipts (return_request_item_id, received_quantity, received_by, note, photos, idempotency_key)
  values (p_request_item_id, p_quantity, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_photos, '{}'), p_idempotency_key);

  v_total_received := v_total_received + p_quantity;
  v_remaining := v_item.requested_quantity - v_total_received;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'ITEM_RECEIVED', 'from', '', 'to', '',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', ''
    ))
    where id = v_req.id;

  -- Only when EVERY item on this request has no outstanding remaining
  -- quantity does the whole request move from AWAITING_RETURN to RECEIVED
  -- (section 47: reuse the existing top-level status, keep per-item detail
  -- in the receipts table).
  select not exists (
    select 1 from public.return_request_items i
    where i.return_request_id = v_req.id
      and i.requested_quantity > coalesce((
        select sum(r.received_quantity) from public.return_request_item_receipts r
        where r.return_request_item_id = i.id
      ), 0)
  ) into v_all_received;

  if v_all_received then
    update public.return_requests set status = 'received' where id = v_req.id;
    update public.return_requests
      set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at', now(), 'action', 'STATUS_CHANGED', 'from', 'awaiting_return', 'to', 'received',
        'by', coalesce(auth.jwt()->>'email', ''), 'note', ''
      ))
      where id = v_req.id;
  end if;

  return jsonb_build_object(
    'success', true, 'received_quantity', p_quantity, 'remaining_quantity', v_remaining,
    'request_status', case when v_all_received then 'received' else v_req.status end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_inspect_return_item -- inspection with split-condition support
-- (sections 8-13, 51-54). `pending` = total received minus already-
-- finalized (sellable/damaged/incomplete) quantity; 'needs_inspection' rows
-- never reduce it, so those units stay re-inspectable. A SELLABLE result
-- writes exactly one inventory_movements row, uniquely tied to this
-- inspection (guards double-restock).
-- ---------------------------------------------------------------------------
create or replace function public.admin_inspect_return_item(
  p_request_item_id uuid, p_quantity int, p_condition text, p_note text default null,
  p_photos text[] default '{}', p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.return_request_items;
  v_req public.return_requests;
  v_existing public.return_request_item_inspections;
  v_total_received int;
  v_finalized int;
  v_pending int;
  v_inspection_id uuid;
  v_product public.products;
  v_variant_key text;
  v_idx int;
  v_new_stock int;
  v_requires_undamaged boolean;
  v_all_finalized boolean;
  v_all_received boolean;
begin
  if not public.has_permission('returns.manage') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;

  if p_condition not in ('sellable', 'damaged', 'incomplete', 'needs_inspection') then
    return jsonb_build_object('success', false, 'message', 'Invalid condition');
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into v_existing from public.return_request_item_inspections where idempotency_key = p_idempotency_key;
    if found then
      select * into v_item from public.return_request_items where id = v_existing.return_request_item_id;
      select * into v_req from public.return_requests where id = v_item.return_request_id;
      return jsonb_build_object('success', true, 'already_existed', true, 'condition', v_existing.condition,
        'quantity', v_existing.quantity, 'request_status', v_req.status);
    end if;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('success', false, 'message', 'Quantity must be positive');
  end if;

  select * into v_item from public.return_request_items where id = p_request_item_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Item not found');
  end if;

  select * into v_req from public.return_requests where id = v_item.return_request_id for update;

  select coalesce(sum(received_quantity), 0) into v_total_received
    from public.return_request_item_receipts where return_request_item_id = v_item.id;
  select coalesce(sum(quantity), 0) into v_finalized
    from public.return_request_item_inspections
    where return_request_item_id = v_item.id and condition in ('sellable', 'damaged', 'incomplete');
  v_pending := v_total_received - v_finalized;

  if p_quantity > v_pending then
    return jsonb_build_object('success', false, 'message', 'Inspected quantity exceeds the quantity pending inspection', 'pending_quantity', v_pending);
  end if;

  insert into public.return_request_item_inspections
    (return_request_item_id, quantity, condition, inspected_by, note, photos, idempotency_key)
  values (p_request_item_id, p_quantity, p_condition, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_photos, '{}'), p_idempotency_key)
  returning id into v_inspection_id;

  if p_condition = 'sellable' then
    if v_item.product_id is not null then
      select o.items -> v_item.order_item_index ->> 'variant_key' into v_variant_key
        from public.orders o where o.id = v_item.order_id;

      select * into v_product from public.products where id = v_item.product_id for update;
      if found then
        if v_variant_key is not null then
          v_idx := public._variant_index(v_product.variants, v_variant_key);
          if v_idx is not null then
            v_new_stock := coalesce((v_product.variants -> v_idx ->> 'stock')::int, 0) + p_quantity;
            update public.products
              set variants = jsonb_set(variants, array[v_idx::text, 'stock'], to_jsonb(v_new_stock)), updated_date = now()
              where id = v_product.id;
          else
            -- Variant no longer exists (product edited since the order) --
            -- fall back to the base stock counter rather than losing the
            -- unit from inventory records entirely (section 17).
            update public.products set stock = stock + p_quantity, updated_date = now() where id = v_product.id;
          end if;
        else
          update public.products set stock = stock + p_quantity, updated_date = now() where id = v_product.id;
        end if;

        insert into public.inventory_movements
          (product_id, variant_key, delta, movement_type, return_request_id, return_request_item_id, inspection_id, order_id, created_by, note)
        values
          (v_product.id, v_variant_key, p_quantity, 'return_restock', v_req.id, v_item.id, v_inspection_id, v_item.order_id, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));
      end if;
      -- v_item.product_id null (bundle sub-item / deleted product at
      -- submission time): nothing to restock against, but the inspection
      -- row above still preserves the fact that this quantity came back
      -- sellable.
    end if;
  elsif p_condition in ('damaged', 'incomplete') then
    v_requires_undamaged := coalesce((v_item.reason_policy_snapshot->>'requires_undamaged_return')::boolean, false);
    if v_requires_undamaged then
      update public.return_requests set needs_admin_disposition_review = true where id = v_req.id;
    end if;
  end if;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'INSPECTION_RECORDED', 'from', '', 'to', '',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', ''
    ))
    where id = v_req.id;

  -- Move RECEIVED -> PROCESSING once every item is both fully received and
  -- fully finalized (no outstanding or needs_inspection quantity left).
  select not exists (
    select 1 from public.return_request_items i
    where i.return_request_id = v_req.id
      and i.requested_quantity > coalesce((select sum(r.received_quantity) from public.return_request_item_receipts r where r.return_request_item_id = i.id), 0)
  ) into v_all_received;

  select v_all_received and not exists (
    select 1 from public.return_request_items i
    where i.return_request_id = v_req.id
      and coalesce((select sum(r.received_quantity) from public.return_request_item_receipts r where r.return_request_item_id = i.id), 0)
        > coalesce((select sum(ins.quantity) from public.return_request_item_inspections ins where ins.return_request_item_id = i.id and ins.condition in ('sellable','damaged','incomplete')), 0)
  ) into v_all_finalized;

  if v_all_finalized and v_req.status = 'received' then
    update public.return_requests set status = 'processing' where id = v_req.id;
    update public.return_requests
      set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at', now(), 'action', 'STATUS_CHANGED', 'from', 'received', 'to', 'processing',
        'by', coalesce(auth.jwt()->>'email', ''), 'note', ''
      ))
      where id = v_req.id;
  end if;

  return jsonb_build_object(
    'success', true, 'condition', p_condition, 'quantity', p_quantity,
    'restocked', p_condition = 'sellable',
    'needs_admin_disposition_review', (select needs_admin_disposition_review from public.return_requests where id = v_req.id),
    'request_status', case when v_all_finalized and v_req.status = 'received' then 'processing' else v_req.status end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_clear_disposition_review -- an authorized admin's considered
-- decision to let a flagged request (section 21, damaged/incomplete return
-- under a "must come back undamaged" reason) proceed to customer
-- resolution anyway. Deliberately just clears the flag with an audited
-- note -- Phase 4 does not add a new post-inspection rejection workflow
-- (that belongs with the settlement logic in a later phase); if the claim
-- should instead be denied, that is a manual/offline decision until then.
-- ---------------------------------------------------------------------------
create or replace function public.admin_clear_disposition_review(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.return_requests;
begin
  if not public.has_permission('returns.manage') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;

  if not v_req.needs_admin_disposition_review then
    return jsonb_build_object('success', true, 'already_cleared', true);
  end if;

  update public.return_requests set needs_admin_disposition_review = false where id = p_request_id;
  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'DISPOSITION_REVIEW_CLEARED', 'from', '', 'to', '',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', coalesce(btrim(p_note), '')
    ))
    where id = p_request_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- customer_select_refund_method -- sections 23-28. Records the choice only;
-- no wallet credit or refund is issued here.
-- ---------------------------------------------------------------------------
create or replace function public.customer_select_refund_method(p_request_id uuid, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.return_requests;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if p_method not in ('wallet', 'refund') then
    return jsonb_build_object('success', false, 'message', 'Invalid method');
  end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found or v_req.created_by_id <> v_uid then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;
  if v_req.request_type <> 'return' then
    return jsonb_build_object('success', false, 'message', 'This request is not a return');
  end if;
  if v_req.status <> 'processing' then
    return jsonb_build_object('success', false, 'message', 'This request is not ready for a refund method yet');
  end if;
  if v_req.needs_admin_disposition_review then
    return jsonb_build_object('success', false, 'message', 'Your request needs a bit more review by our team first');
  end if;

  update public.return_requests set refund_method = p_method, refund_method_selected_at = now() where id = p_request_id;
  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'REFUND_METHOD_SELECTED', 'from', '', 'to', '',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', p_method
    ))
    where id = p_request_id;

  return jsonb_build_object('success', true, 'refund_method', p_method);
end;
$$;

-- ---------------------------------------------------------------------------
-- customer_select_exchange_replacement -- sections 32-42. Selection and
-- reservation happen together, exactly at the point the customer confirms
-- (never earlier -- section 38). Validates availability (stock -
-- reserved_stock) under a row lock, then increments reserved_stock by the
-- same amount -- a real hold, not a completed sale (section 37).
-- ---------------------------------------------------------------------------
create or replace function public.customer_select_exchange_replacement(
  p_request_item_id uuid, p_mode text, p_product_id uuid, p_variant_key text, p_quantity int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.return_request_items;
  v_req public.return_requests;
  v_target_product_id uuid;
  v_target_variant_key text;
  v_product public.products;
  v_idx int;
  v_available int;
  v_unit_price numeric;
  v_diff numeric;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if p_mode not in ('same_product', 'different_product') then
    return jsonb_build_object('success', false, 'message', 'Invalid mode');
  end if;
  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('success', false, 'message', 'Quantity must be positive');
  end if;

  select * into v_item from public.return_request_items where id = p_request_item_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Item not found');
  end if;

  select * into v_req from public.return_requests where id = v_item.return_request_id for update;
  if v_req.created_by_id <> v_uid then
    return jsonb_build_object('success', false, 'message', 'Item not found');
  end if;
  if v_req.status <> 'processing' then
    return jsonb_build_object('success', false, 'message', 'This request is not ready for replacement selection yet');
  end if;
  if v_req.needs_admin_disposition_review then
    return jsonb_build_object('success', false, 'message', 'Your request needs a bit more review by our team first');
  end if;
  if v_req.request_type <> 'exchange' and v_item.missing_resolution <> 'full_exchange' then
    return jsonb_build_object('success', false, 'message', 'This item is not an exchange');
  end if;
  if v_item.replacement_reserved_at is not null then
    return jsonb_build_object('success', false, 'message', 'A replacement has already been selected for this item');
  end if;
  if p_quantity > v_item.requested_quantity then
    return jsonb_build_object('success', false, 'message', 'Quantity exceeds the approved quantity');
  end if;

  if p_mode = 'same_product' then
    v_target_product_id := v_item.product_id;
    if v_target_product_id is null then
      return jsonb_build_object('success', false, 'message', 'This item has no product to re-select');
    end if;
    select o.items -> v_item.order_item_index ->> 'variant_key' into v_target_variant_key
      from public.orders o where o.id = v_item.order_id;
  else
    if p_product_id is null then
      return jsonb_build_object('success', false, 'message', 'Choose a replacement product');
    end if;
    v_target_product_id := p_product_id;
    v_target_variant_key := nullif(p_variant_key, '');
  end if;

  select * into v_product from public.products where id = v_target_product_id for update;
  if not found or v_product.status <> 'published' then
    return jsonb_build_object('success', false, 'message', 'This product is not available');
  end if;

  if v_target_variant_key is not null then
    v_idx := public._variant_index(v_product.variants, v_target_variant_key);
    if v_idx is null or coalesce((v_product.variants -> v_idx ->> 'active')::boolean, true) = false then
      return jsonb_build_object('success', false, 'message', 'This variant is not available');
    end if;
    v_available := coalesce((v_product.variants -> v_idx ->> 'stock')::int, 0) - coalesce((v_product.variants -> v_idx ->> 'reserved_stock')::int, 0);
    if v_available < p_quantity then
      return jsonb_build_object('success', false, 'message', 'Not enough stock available for this variant', 'available', greatest(0, v_available));
    end if;
    update public.products
      set variants = jsonb_set(variants, array[v_idx::text, 'reserved_stock'], to_jsonb(coalesce((v_product.variants -> v_idx ->> 'reserved_stock')::int, 0) + p_quantity)),
          updated_date = now()
      where id = v_product.id;
    v_unit_price := coalesce(nullif(v_product.variants -> v_idx ->> 'price', '')::numeric, v_product.sale_price, v_product.price);
  else
    v_available := v_product.stock - v_product.reserved_stock;
    if v_available < p_quantity then
      return jsonb_build_object('success', false, 'message', 'Not enough stock available', 'available', greatest(0, v_available));
    end if;
    update public.products set reserved_stock = reserved_stock + p_quantity, updated_date = now() where id = v_product.id;
    v_unit_price := coalesce(v_product.sale_price, v_product.price);
  end if;

  v_diff := round((coalesce(v_unit_price, 0) - coalesce(v_item.unit_price, 0)) * p_quantity, 2);

  update public.return_request_items set
    exchange_replacement_mode = p_mode,
    replacement_product_id = v_target_product_id,
    replacement_variant_key = v_target_variant_key,
    replacement_quantity = p_quantity,
    replacement_unit_price = v_unit_price,
    replacement_price_difference = v_diff,
    replacement_confirmed_at = now(),
    replacement_reserved_at = now()
    where id = p_request_item_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'EXCHANGE_REPLACEMENT_RESERVED', 'from', '', 'to', '',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', ''
    ))
    where id = v_req.id;

  return jsonb_build_object('success', true, 'replacement_unit_price', v_unit_price, 'price_difference', v_diff);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_release_exchange_reservation -- section 39. Releases the reserved
-- stock and clears the selection so the customer (or admin, offline) can
-- pick again.
-- ---------------------------------------------------------------------------
create or replace function public.admin_release_exchange_reservation(p_request_item_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.return_request_items;
  v_req public.return_requests;
  v_product public.products;
  v_idx int;
begin
  if not public.has_permission('returns.manage') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;

  select * into v_item from public.return_request_items where id = p_request_item_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Item not found');
  end if;
  if v_item.replacement_reserved_at is null then
    return jsonb_build_object('success', true, 'already_released', true);
  end if;

  select * into v_req from public.return_requests where id = v_item.return_request_id for update;

  select * into v_product from public.products where id = v_item.replacement_product_id for update;
  if found then
    if v_item.replacement_variant_key is not null then
      v_idx := public._variant_index(v_product.variants, v_item.replacement_variant_key);
      if v_idx is not null then
        update public.products
          set variants = jsonb_set(variants, array[v_idx::text, 'reserved_stock'],
            to_jsonb(greatest(0, coalesce((v_product.variants -> v_idx ->> 'reserved_stock')::int, 0) - coalesce(v_item.replacement_quantity, 0)))),
            updated_date = now()
          where id = v_product.id;
      end if;
    else
      update public.products
        set reserved_stock = greatest(0, reserved_stock - coalesce(v_item.replacement_quantity, 0)), updated_date = now()
        where id = v_product.id;
    end if;
  end if;

  update public.return_request_items set
    exchange_replacement_mode = null, replacement_product_id = null, replacement_variant_key = null,
    replacement_quantity = null, replacement_unit_price = null, replacement_price_difference = null,
    replacement_confirmed_at = null, replacement_reserved_at = null, replacement_released_at = now()
    where id = p_request_item_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'EXCHANGE_RESERVATION_RELEASED', 'from', '', 'to', '',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', coalesce(btrim(p_note), '')
    ))
    where id = v_req.id;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_set_missing_resolution -- sections 43-46. No physical item ever
-- existed, so this never touches receipts/inspections/inventory_movements.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_missing_resolution(p_request_item_id uuid, p_resolution text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.return_request_items;
  v_req public.return_requests;
  v_all_set boolean;
begin
  if not public.has_permission('returns.manage') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;

  select * into v_item from public.return_request_items where id = p_request_item_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Item not found');
  end if;
  if v_item.resolution_type not in ('missing_item', 'missing_part') then
    return jsonb_build_object('success', false, 'message', 'This item is not a missing item/part claim');
  end if;
  if v_item.resolution_type = 'missing_item' and p_resolution <> 'send_missing_item' then
    return jsonb_build_object('success', false, 'message', 'Invalid resolution for a missing item claim');
  end if;
  if v_item.resolution_type = 'missing_part' and p_resolution not in ('send_missing_part', 'full_exchange') then
    return jsonb_build_object('success', false, 'message', 'Invalid resolution for a missing part claim');
  end if;

  select * into v_req from public.return_requests where id = v_item.return_request_id for update;
  if v_req.status <> 'approved' then
    return jsonb_build_object('success', false, 'message', 'This request is not awaiting a resolution');
  end if;

  update public.return_request_items set missing_resolution = p_resolution where id = p_request_item_id;

  select not exists (
    select 1 from public.return_request_items i
    where i.return_request_id = v_req.id and i.missing_resolution is null
  ) into v_all_set;

  if v_all_set then
    update public.return_requests set status = 'processing' where id = v_req.id;
    update public.return_requests
      set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at', now(), 'action', 'STATUS_CHANGED', 'from', 'approved', 'to', 'processing',
        'by', coalesce(auth.jwt()->>'email', ''), 'note', ''
      ))
      where id = v_req.id;
  end if;

  return jsonb_build_object('success', true, 'resolution', p_resolution, 'request_status', case when v_all_set then 'processing' else v_req.status end);
end;
$$;
