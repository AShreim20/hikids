-- Returns & Exchanges -- Phase 2: customer submission/tracking.
--
-- Builds on 0031_returns_foundation.sql (return_reasons, return_requests,
-- return_request_items) without altering any of its existing columns,
-- constraints, or admin-facing policies. Adds only:
--   - two small columns (idempotency_key, evidence_urls) needed for a safe
--     customer submission path that didn't exist yet in Phase 1
--   - customer-scoped read-own RLS policies (additive -- Postgres combines
--     multiple permissive policies with OR, so the existing admin
--     `returns.manage` policies are untouched)
--   - a 'returns' folder on the existing customer-uploads storage bucket,
--     same per-uid-folder pattern already used by reviews/challenges
--   - submit_return_request()/cancel_return_request(): the "controlled
--     insert path" Phase 1's own migration comments said Phase 2 must add,
--     instead of an open client-side insert policy -- mirrors
--     secure_order()/challenges_claim()'s existing style (SECURITY DEFINER,
--     `select ... for update`, ownership check via created_by_id/
--     customer_email, jsonb_build_object('success', ...) returns).
--
-- Nothing here touches orders/products/loyalty/wheel data, and no
-- inventory, refund, or loyalty logic is added -- see the two RPCs below,
-- neither writes anywhere outside return_requests/return_request_items.

alter table public.return_requests
  add column if not exists idempotency_key text;

create unique index if not exists return_requests_idempotency_key_idx
  on public.return_requests (idempotency_key) where idempotency_key is not null;

alter table public.return_request_items
  add column if not exists evidence_urls text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Customer read-own access (additive to Phase 1's has_permission('returns.manage')
-- policies -- admin/staff access is unchanged).
-- ---------------------------------------------------------------------------
create policy "return_requests_read_own" on public.return_requests
  for select using (created_by_id = auth.uid());

create policy "return_request_items_read_own" on public.return_request_items
  for select using (
    exists (
      select 1 from public.return_requests rr
      where rr.id = return_request_items.return_request_id and rr.created_by_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: reuse the existing customer-uploads bucket (0022) -- add a
-- 'returns' folder to the same own-uid-folder allowlist 'reviews'/
-- 'challenges' already use. Nothing else about the bucket changes.
-- ---------------------------------------------------------------------------
drop policy if exists "customer_uploads_insert" on storage.objects;
create policy "customer_uploads_insert" on storage.objects
  for insert with check (
    bucket_id = 'customer-uploads' and (
      public.is_admin()
      or (
        auth.role() = 'authenticated'
        and (storage.foldername(name))[1] in ('reviews', 'challenges', 'returns')
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- ---------------------------------------------------------------------------
-- submit_return_request -- validates everything server-side before writing
-- anything (fail-fast: the validation loop below never touches
-- return_requests/return_request_items, so a rejected submission leaves no
-- partial rows). One request, one reason, one request_type, evidence shared
-- across every selected item -- a deliberate Phase 2 simplification of
-- Phase 1's per-item reason_id column (kept for a future richer UI), not a
-- schema change.
-- ---------------------------------------------------------------------------
create or replace function public.submit_return_request(
  p_order_id uuid,
  p_request_type text,
  p_reason_id uuid,
  p_customer_note text,
  p_resolution_type text,
  p_evidence_urls text[],
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_order public.orders;
  v_reason public.return_reasons;
  v_delivered_at timestamptz;
  v_existing public.return_requests;
  v_item jsonb;
  v_idx int;
  v_qty int;
  v_order_item jsonb;
  v_purchased int;
  v_reserved int;
  v_remaining int;
  v_evidence_count int;
  v_snapshot jsonb;
  v_request_id uuid;
  v_request_code text;
  v_product_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into v_existing from public.return_requests
      where idempotency_key = p_idempotency_key and created_by_id = v_uid;
    if found then
      return jsonb_build_object('success', true, 'request_id', v_existing.id, 'request_code', v_existing.request_code, 'already_existed', true);
    end if;
  end if;

  if p_request_type not in ('return', 'exchange') then
    return jsonb_build_object('success', false, 'message', 'Invalid request type');
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'message', 'Select at least one item');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;
  if not ((v_order.created_by_id = v_uid) or (v_order.customer_email = v_email)) then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  if v_order.status <> 'delivered' then
    return jsonb_build_object('success', false, 'message', 'Order must be delivered before requesting a return or exchange');
  end if;

  select max((entry->>'at')::timestamptz) into v_delivered_at
    from jsonb_array_elements(coalesce(v_order.activity, '[]'::jsonb)) entry
    where entry->>'action' = 'status' and entry->>'to' = 'delivered';

  if v_delivered_at is null then
    return jsonb_build_object('success', false, 'message', 'Delivery date not found for this order');
  end if;
  if now() > v_delivered_at + interval '3 days' then
    return jsonb_build_object('success', false, 'message', 'The 3-day return window for this order has closed');
  end if;

  select * into v_reason from public.return_reasons where id = p_reason_id and active = true;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Selected reason is not available');
  end if;

  if p_resolution_type is not null and p_resolution_type not in ('missing_item', 'missing_part', 'wrong_item', 'damaged_item') then
    return jsonb_build_object('success', false, 'message', 'Invalid resolution type');
  end if;
  if p_resolution_type = 'missing_item' and not v_reason.allow_missing_item then
    return jsonb_build_object('success', false, 'message', 'Selected reason does not support this resolution');
  elsif p_resolution_type = 'missing_part' and not v_reason.allow_missing_part then
    return jsonb_build_object('success', false, 'message', 'Selected reason does not support this resolution');
  elsif p_resolution_type is null then
    if p_request_type = 'return' and not v_reason.allow_return then
      return jsonb_build_object('success', false, 'message', 'Selected reason does not allow returns');
    end if;
    if p_request_type = 'exchange' and not v_reason.allow_exchange then
      return jsonb_build_object('success', false, 'message', 'Selected reason does not allow exchanges');
    end if;
  end if;

  v_evidence_count := coalesce(array_length(p_evidence_urls, 1), 0);
  if v_reason.evidence_required and v_evidence_count < v_reason.evidence_min_images then
    return jsonb_build_object('success', false, 'message', 'Not enough evidence photos attached');
  end if;
  if v_evidence_count > v_reason.evidence_max_images then
    return jsonb_build_object('success', false, 'message', 'Too many evidence photos attached');
  end if;

  -- Validate every item before writing anything.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_idx := (v_item->>'order_item_index')::int;
    v_qty := (v_item->>'requested_quantity')::int;

    if v_idx is null or v_idx < 0 or v_idx >= jsonb_array_length(coalesce(v_order.items, '[]'::jsonb)) then
      return jsonb_build_object('success', false, 'message', 'Invalid item selection');
    end if;
    if v_qty is null or v_qty <= 0 then
      return jsonb_build_object('success', false, 'message', 'Invalid quantity');
    end if;

    v_order_item := v_order.items -> v_idx;
    v_purchased := coalesce((v_order_item->>'qty')::int, 0);

    select coalesce(sum(rri.requested_quantity), 0) into v_reserved
      from public.return_request_items rri
      join public.return_requests rr on rr.id = rri.return_request_id
      where rri.order_id = p_order_id
        and rri.order_item_index = v_idx
        and rr.status not in ('rejected', 'cancelled');

    v_remaining := v_purchased - v_reserved;
    if v_qty > v_remaining then
      return jsonb_build_object('success', false, 'message', 'Requested quantity exceeds what is still eligible for this item');
    end if;
  end loop;

  v_snapshot := jsonb_build_object(
    'name', v_reason.name, 'name_en', v_reason.name_en,
    'allow_return', v_reason.allow_return, 'allow_exchange', v_reason.allow_exchange,
    'allow_missing_item', v_reason.allow_missing_item, 'allow_missing_part', v_reason.allow_missing_part,
    'delivery_responsibility', v_reason.delivery_responsibility,
    'evidence_required', v_reason.evidence_required,
    'evidence_min_images', v_reason.evidence_min_images, 'evidence_max_images', v_reason.evidence_max_images
  );

  insert into public.return_requests (order_id, request_type, status, customer_note, submitted_at, activity, idempotency_key)
  values (
    p_order_id, p_request_type, 'submitted', nullif(btrim(coalesce(p_customer_note, '')), ''), now(),
    jsonb_build_array(jsonb_build_object('at', now(), 'action', 'SUBMITTED', 'from', '', 'to', 'submitted', 'by', coalesce(v_email, ''), 'note', '')),
    p_idempotency_key
  )
  returning id, request_code into v_request_id, v_request_code;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_idx := (v_item->>'order_item_index')::int;
    v_qty := (v_item->>'requested_quantity')::int;
    v_order_item := v_order.items -> v_idx;

    v_product_id := case when coalesce((v_order_item->>'is_bundle')::boolean, false) then null
      else nullif(v_order_item->>'id', '')::uuid end;
    if v_product_id is not null and not exists (select 1 from public.products where id = v_product_id) then
      v_product_id := null;
    end if;

    insert into public.return_request_items (
      return_request_id, order_id, order_item_index, product_id,
      product_name, product_name_en, sku, unit_price, purchased_quantity, requested_quantity,
      reason_id, reason_policy_snapshot, resolution_type, evidence_urls
    ) values (
      v_request_id, p_order_id, v_idx, v_product_id,
      v_order_item->>'name', v_order_item->>'name_en', v_order_item->>'sku',
      nullif(v_order_item->>'price', '')::numeric,
      coalesce((v_order_item->>'qty')::int, 0), v_qty,
      p_reason_id, v_snapshot, p_resolution_type, coalesce(p_evidence_urls, '{}')
    );
  end loop;

  return jsonb_build_object('success', true, 'request_id', v_request_id, 'request_code', v_request_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_return_request -- customer self-service cancel, only while still in
-- an early, safe status (nothing operational has started yet). Status
-- change only -- the request/items/evidence rows are never deleted.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_return_request(p_request_id uuid)
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

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found or v_req.created_by_id <> v_uid then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;

  if v_req.status not in ('submitted', 'under_review', 'needs_information') then
    return jsonb_build_object('success', false, 'message', 'This request can no longer be cancelled');
  end if;

  update public.return_requests
    set status = 'cancelled',
        activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'at', now(), 'action', 'STATUS_CHANGED', 'from', v_req.status, 'to', 'cancelled',
          'by', coalesce(auth.jwt()->>'email', ''), 'note', 'Cancelled by customer'
        ))
    where id = p_request_id;

  return jsonb_build_object('success', true);
end;
$$;
