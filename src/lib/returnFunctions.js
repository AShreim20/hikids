import { supabase } from '@/api/supabaseClient';

// Thin wrappers around the Postgres RPCs from migration 0032 -- same
// reasoning as orderFunctions.js/challengeFunctions.js: all validation
// (ownership, delivery window, quantity, evidence, reason policy) happens
// server-side, so a client-computed value is never trusted for these calls.

export async function submitReturnRequest({
  orderId, requestType, reasonId, customerNote, resolutionType,
  evidenceUrls, items, idempotencyKey,
}) {
  const { data, error } = await supabase.rpc('submit_return_request', {
    p_order_id: orderId,
    p_request_type: requestType,
    p_reason_id: reasonId,
    p_customer_note: customerNote || null,
    p_resolution_type: resolutionType || null,
    p_evidence_urls: evidenceUrls || [],
    p_items: items,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function cancelReturnRequest(requestId) {
  const { data, error } = await supabase.rpc('cancel_return_request', { p_request_id: requestId });
  if (error) throw error;
  return data;
}

// Customer-initiated response to an admin NEEDS_INFORMATION request
// (migration 0033) — appends to the request's timeline and, optionally,
// more evidence photos, then flips the request back to UNDER_REVIEW.
export async function respondToInformationRequest(requestId, message, evidenceUrls) {
  const { data, error } = await supabase.rpc('customer_respond_to_information_request', {
    p_request_id: requestId,
    p_message: message || null,
    p_evidence_urls: evidenceUrls || [],
  });
  if (error) throw error;
  return data;
}

// --- Admin review RPCs (migration 0033) -------------------------------
// Every write goes through one of these — the Admin UI never issues a raw
// status update. Each mutating action takes `expectedStatus` (optimistic
// concurrency: the RPC rejects with {message:'stale'} if another admin
// already moved the request since this page loaded it).

export async function adminStartReview(requestId) {
  const { data, error } = await supabase.rpc('admin_start_review', { p_request_id: requestId });
  if (error) throw error;
  return data;
}

export async function adminRequestInformation(requestId, message, expectedStatus) {
  const { data, error } = await supabase.rpc('admin_request_information', {
    p_request_id: requestId, p_message: message, p_expected_status: expectedStatus,
  });
  if (error) throw error;
  return data;
}

export async function adminApproveReturnRequest(requestId, expectedStatus, customerMessage, deliveryResponsibilityDecision) {
  const { data, error } = await supabase.rpc('admin_approve_return_request', {
    p_request_id: requestId, p_expected_status: expectedStatus,
    p_customer_message: customerMessage || null,
    p_delivery_responsibility_decision: deliveryResponsibilityDecision || null,
  });
  if (error) throw error;
  return data;
}

export async function adminRejectReturnRequest(requestId, expectedStatus, rejectionReason) {
  const { data, error } = await supabase.rpc('admin_reject_return_request', {
    p_request_id: requestId, p_expected_status: expectedStatus, p_rejection_reason: rejectionReason,
  });
  if (error) throw error;
  return data;
}

export async function adminAddInternalNote(requestId, note) {
  const { data, error } = await supabase.rpc('admin_add_internal_note', {
    p_request_id: requestId, p_note: note,
  });
  if (error) throw error;
  return data;
}

// --- Phase 4: physical receiving, inspection, resolution (migration 0034) --

export async function adminReceiveReturnItem(requestItemId, quantity, note, photos, idempotencyKey) {
  const { data, error } = await supabase.rpc('admin_receive_return_item', {
    p_request_item_id: requestItemId, p_quantity: quantity,
    p_note: note || null, p_photos: photos || [], p_idempotency_key: idempotencyKey || null,
  });
  if (error) throw error;
  return data;
}

export async function adminInspectReturnItem(requestItemId, quantity, condition, note, photos, idempotencyKey) {
  const { data, error } = await supabase.rpc('admin_inspect_return_item', {
    p_request_item_id: requestItemId, p_quantity: quantity, p_condition: condition,
    p_note: note || null, p_photos: photos || [], p_idempotency_key: idempotencyKey || null,
  });
  if (error) throw error;
  return data;
}

export async function adminClearDispositionReview(requestId, note) {
  const { data, error } = await supabase.rpc('admin_clear_disposition_review', {
    p_request_id: requestId, p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function adminReleaseExchangeReservation(requestItemId, note) {
  const { data, error } = await supabase.rpc('admin_release_exchange_reservation', {
    p_request_item_id: requestItemId, p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function adminSetMissingResolution(requestItemId, resolution) {
  const { data, error } = await supabase.rpc('admin_set_missing_resolution', {
    p_request_item_id: requestItemId, p_resolution: resolution,
  });
  if (error) throw error;
  return data;
}

export async function customerSelectRefundMethod(requestId, method) {
  const { data, error } = await supabase.rpc('customer_select_refund_method', {
    p_request_id: requestId, p_method: method,
  });
  if (error) throw error;
  return data;
}

export async function customerSelectExchangeReplacement(requestItemId, mode, productId, variantKey, quantity) {
  const { data, error } = await supabase.rpc('customer_select_exchange_replacement', {
    p_request_item_id: requestItemId, p_mode: mode, p_product_id: productId || null,
    p_variant_key: variantKey || null, p_quantity: quantity,
  });
  if (error) throw error;
  return data;
}
