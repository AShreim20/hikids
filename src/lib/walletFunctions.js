import { supabase } from '@/api/supabaseClient';

// Thin wrappers around the Phase 5 financial-settlement RPCs (migration
// 0035-0037) -- same reasoning as returnFunctions.js: every amount is
// computed/validated server-side, the client only ever submits an intent
// (which settlement/refund id to act on), never a monetary value.

export async function calculateReturnSettlement(returnRequestId) {
  const { data, error } = await supabase.rpc('calculate_return_settlement', { p_return_request_id: returnRequestId });
  if (error) throw error;
  return data;
}

export async function adminConfirmReturnSettlement(settlementId, expectedStatus) {
  const { data, error } = await supabase.rpc('admin_confirm_return_settlement', {
    p_settlement_id: settlementId, p_expected_status: expectedStatus,
  });
  if (error) throw error;
  return data;
}

export async function adminCompleteManualRefund(refundId, externalReference, note) {
  const { data, error } = await supabase.rpc('admin_complete_manual_refund', {
    p_refund_id: refundId, p_external_reference: externalReference, p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function adminFailRefund(refundId, reason) {
  const { data, error } = await supabase.rpc('admin_fail_refund', { p_refund_id: refundId, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function adminRetryRefund(refundId) {
  const { data, error } = await supabase.rpc('admin_retry_refund', { p_refund_id: refundId });
  if (error) throw error;
  return data;
}

export async function customerPayExchangeDifferenceFromWallet(settlementId) {
  const { data, error } = await supabase.rpc('customer_pay_exchange_difference_from_wallet', { p_settlement_id: settlementId });
  if (error) throw error;
  return data;
}

export async function adminReverseSettlement(settlementId, reason) {
  const { data, error } = await supabase.rpc('admin_reverse_settlement', { p_settlement_id: settlementId, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function customerChooseExchangeCashOnDelivery(settlementId) {
  const { data, error } = await supabase.rpc('customer_choose_exchange_cash_on_delivery', { p_settlement_id: settlementId });
  if (error) throw error;
  return data;
}

export async function adminConfirmExchangeCashCollected(settlementId) {
  const { data, error } = await supabase.rpc('admin_confirm_exchange_cash_collected', { p_settlement_id: settlementId });
  if (error) throw error;
  return data;
}
