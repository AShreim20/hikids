-- Returns & Exchanges -- Phase 3: admin review/decision workflow.
--
-- Builds on 0031 (foundation) and 0032 (customer submission) without
-- altering any existing column/constraint/policy. Adds only:
--   - return_requests.delivery_responsibility_decision -- the one place
--     Phase 1's policy snapshot genuinely needed extending: a
--     'manual_review' reason has no fixed answer, so admin's approval-time
--     decision has to be stored and audited somewhere (section 56).
--   - return_request_notes -- a separate, admin-only table for internal
--     notes. Kept OUT of return_requests entirely (rather than a column)
--     specifically so a customer's existing `return_requests_read_own`
--     policy can never expose it via `select *` -- this is a schema-level
--     guarantee, not a UI-hiding one (section 49).
--   - six SECURITY DEFINER RPCs that are the ONLY sanctioned way to move a
--     request through the workflow. The existing admin RLS
--     (`return_requests_manage`/`return_request_items_manage`, both
--     `for all` on has_permission('returns.manage')) still technically
--     permits a raw UPDATE, matching every other admin-write table in this
--     schema (e.g. orders) -- what actually enforces "no arbitrary status
--     editing" is that the Admin UI built in this phase only ever calls
--     these RPCs, which validate the transition and use optimistic
--     concurrency (`p_expected_status`) before writing anything.
--
-- Nothing here touches inventory, payments, or loyalty/wheel tables.

alter table public.return_requests
  add column if not exists delivery_responsibility_decision text
    check (delivery_responsibility_decision is null or delivery_responsibility_decision in ('hikids', 'customer'));

create table public.return_request_notes (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  note text not null
);

create index return_request_notes_return_request_id_idx on public.return_request_notes (return_request_id);

alter table public.return_request_notes enable row level security;

-- Admin/staff only -- deliberately no customer policy at all (see header).
create policy "return_request_notes_manage" on public.return_request_notes
  for all using (public.has_permission('returns.manage'))
  with check (public.has_permission('returns.manage'));

-- ---------------------------------------------------------------------------
-- admin_start_review -- SUBMITTED -> UNDER_REVIEW. Called once when an
-- admin first opens a submitted request (see ReturnRequestAdminDetail.jsx);
-- a no-op (still success) if the request has already moved past SUBMITTED,
-- so opening an already-reviewed request never errors.
-- ---------------------------------------------------------------------------
create or replace function public.admin_start_review(p_request_id uuid)
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

  if v_req.status <> 'submitted' then
    return jsonb_build_object('success', true, 'status', v_req.status);
  end if;

  update public.return_requests
    set status = 'under_review'
    where id = p_request_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'STATUS_CHANGED', 'from', 'submitted', 'to', 'under_review',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', ''
    ))
    where id = p_request_id;

  return jsonb_build_object('success', true, 'status', 'under_review');
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_request_information -- (SUBMITTED or UNDER_REVIEW) -> NEEDS_INFORMATION.
-- p_message is customer-visible (stored on admin_note, the same column the
-- Phase 2 customer detail page already reads for this exact banner).
-- ---------------------------------------------------------------------------
create or replace function public.admin_request_information(
  p_request_id uuid, p_message text, p_expected_status text
)
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
  if p_message is null or btrim(p_message) = '' then
    return jsonb_build_object('success', false, 'message', 'A customer-visible message is required');
  end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;
  if v_req.status <> p_expected_status then
    return jsonb_build_object('success', false, 'message', 'stale', 'current_status', v_req.status);
  end if;
  if v_req.status not in ('submitted', 'under_review') then
    return jsonb_build_object('success', false, 'message', 'This request cannot be moved to Needs Information from its current status');
  end if;

  update public.return_requests
    set status = 'needs_information', admin_note = btrim(p_message)
    where id = p_request_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'INFO_REQUESTED', 'from', v_req.status, 'to', 'needs_information',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', btrim(p_message)
    ))
    where id = p_request_id;

  return jsonb_build_object('success', true, 'status', 'needs_information');
end;
$$;

-- ---------------------------------------------------------------------------
-- customer_respond_to_information_request -- NEEDS_INFORMATION -> UNDER_REVIEW.
-- Customer-initiated. Appends response text to the activity timeline
-- (preserving every round, however many there are) and optionally appends
-- more evidence to every item on the request, capped at the reason's own
-- configured max (never re-validated against min, since evidence already
-- satisfied the original submission).
-- ---------------------------------------------------------------------------
create or replace function public.customer_respond_to_information_request(
  p_request_id uuid, p_message text, p_evidence_urls text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.return_requests;
  v_item public.return_request_items;
  v_max int;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found or v_req.created_by_id <> v_uid then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;
  if v_req.status <> 'needs_information' then
    return jsonb_build_object('success', false, 'message', 'This request is not awaiting information');
  end if;
  if (p_message is null or btrim(p_message) = '') and coalesce(array_length(p_evidence_urls, 1), 0) = 0 then
    return jsonb_build_object('success', false, 'message', 'Add a message or a photo');
  end if;

  if coalesce(array_length(p_evidence_urls, 1), 0) > 0 then
    for v_item in select * from public.return_request_items where return_request_id = p_request_id
    loop
      v_max := coalesce((v_item.reason_policy_snapshot->>'evidence_max_images')::int, 5);
      update public.return_request_items
        set evidence_urls = (
          v_item.evidence_urls || (
            select coalesce(array_agg(u), '{}') from unnest(p_evidence_urls) u
            where u <> all(v_item.evidence_urls)
          )
        )[1:greatest(1, v_max)]
        where id = v_item.id;
    end loop;
  end if;

  update public.return_requests
    set status = 'under_review'
    where id = p_request_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'CUSTOMER_RESPONDED', 'from', 'needs_information', 'to', 'under_review',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', coalesce(btrim(p_message), '')
    ))
    where id = p_request_id;

  return jsonb_build_object('success', true, 'status', 'under_review');
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_approve_return_request -- UNDER_REVIEW -> APPROVED or AWAITING_RETURN.
-- Routing (section 26/50/51): a request whose items resolve to
-- missing_item/missing_part never expects a physical item back, so it
-- stops at APPROVED; an ordinary return/exchange moves to AWAITING_RETURN
-- since the product is still expected back. Never touches stock/payment/
-- loyalty -- only return_requests columns change.
-- ---------------------------------------------------------------------------
create or replace function public.admin_approve_return_request(
  p_request_id uuid, p_expected_status text, p_customer_message text,
  p_delivery_responsibility_decision text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.return_requests;
  v_resolution_type text;
  v_snapshot_delivery text;
  v_target_status text;
begin
  if not public.has_permission('returns.manage') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;
  if v_req.status <> p_expected_status then
    return jsonb_build_object('success', false, 'message', 'stale', 'current_status', v_req.status);
  end if;
  if v_req.status <> 'under_review' then
    return jsonb_build_object('success', false, 'message', 'Only a request under review can be approved');
  end if;

  select resolution_type, reason_policy_snapshot->>'delivery_responsibility'
    into v_resolution_type, v_snapshot_delivery
    from public.return_request_items where return_request_id = p_request_id limit 1;

  if v_snapshot_delivery = 'manual_review' then
    if p_delivery_responsibility_decision is null or p_delivery_responsibility_decision not in ('hikids', 'customer') then
      return jsonb_build_object('success', false, 'message', 'Choose who is responsible for delivery before approving');
    end if;
  elsif p_delivery_responsibility_decision is not null then
    return jsonb_build_object('success', false, 'message', 'Delivery responsibility is already set by the reason policy');
  end if;

  v_target_status := case when v_resolution_type in ('missing_item', 'missing_part') then 'approved' else 'awaiting_return' end;

  update public.return_requests
    set status = v_target_status,
        reviewed_at = now(), reviewed_by = auth.uid(),
        admin_note = nullif(btrim(coalesce(p_customer_message, '')), ''),
        delivery_responsibility_decision = coalesce(p_delivery_responsibility_decision, delivery_responsibility_decision)
    where id = p_request_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'APPROVED', 'from', 'under_review', 'to', v_target_status,
      'by', coalesce(auth.jwt()->>'email', ''), 'note', coalesce(btrim(p_customer_message), '')
    ))
    where id = p_request_id;

  return jsonb_build_object('success', true, 'status', v_target_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_reject_return_request -- UNDER_REVIEW -> REJECTED. Requires a
-- non-empty customer-visible reason (section 28/29).
-- ---------------------------------------------------------------------------
create or replace function public.admin_reject_return_request(
  p_request_id uuid, p_expected_status text, p_rejection_reason text
)
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
  if p_rejection_reason is null or btrim(p_rejection_reason) = '' then
    return jsonb_build_object('success', false, 'message', 'A rejection reason is required');
  end if;

  select * into v_req from public.return_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;
  if v_req.status <> p_expected_status then
    return jsonb_build_object('success', false, 'message', 'stale', 'current_status', v_req.status);
  end if;
  if v_req.status <> 'under_review' then
    return jsonb_build_object('success', false, 'message', 'Only a request under review can be rejected');
  end if;

  update public.return_requests
    set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
        rejection_reason = btrim(p_rejection_reason)
    where id = p_request_id;

  update public.return_requests
    set activity = coalesce(activity, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'action', 'REJECTED', 'from', 'under_review', 'to', 'rejected',
      'by', coalesce(auth.jwt()->>'email', ''), 'note', btrim(p_rejection_reason)
    ))
    where id = p_request_id;

  return jsonb_build_object('success', true, 'status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_add_internal_note -- append-only, staff-only, never touches status.
-- ---------------------------------------------------------------------------
create or replace function public.admin_add_internal_note(p_request_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('returns.manage') then
    return jsonb_build_object('success', false, 'message', 'Not authorized');
  end if;
  if p_note is null or btrim(p_note) = '' then
    return jsonb_build_object('success', false, 'message', 'Note cannot be empty');
  end if;
  if not exists (select 1 from public.return_requests where id = p_request_id) then
    return jsonb_build_object('success', false, 'message', 'Request not found');
  end if;

  insert into public.return_request_notes (return_request_id, note)
  values (p_request_id, btrim(p_note))
  returning id into v_id;

  return jsonb_build_object('success', true, 'note_id', v_id);
end;
$$;
