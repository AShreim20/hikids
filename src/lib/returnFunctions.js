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
