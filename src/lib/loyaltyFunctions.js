import { supabase } from '@/api/supabaseClient';

// Thin wrappers around the Postgres RPC functions from migration 0009 —
// these replace Base44's 9 loyalty functions. No Edge Function needed, same
// reasoning as src/lib/orderFunctions.js: each is a SECURITY DEFINER
// Postgres function that reads auth.uid()/auth.jwt() from the caller's own
// request. Each already returns the same jsonb shape the Base44 functions
// returned after unwrap(), so callers use the result as-is.

export async function getLoyaltyBalance({ subtotal = 0, deliveryCost = 0, discountAmount = 0, limit = 10 } = {}) {
  const { data, error } = await supabase.rpc('get_loyalty_balance', {
    p_subtotal: subtotal, p_delivery_cost: deliveryCost, p_discount_amount: discountAmount, p_limit: limit,
  });
  if (error) throw error;
  return data;
}

export async function awardLoyaltyPoints(orderId) {
  const { data, error } = await supabase.rpc('award_loyalty_points', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function redeemLoyaltyPoints({ points, subtotal = 0, deliveryCost = 0, discountAmount = 0, orderId = null, idempotencyKey = null, reason = null }) {
  const { data, error } = await supabase.rpc('redeem_loyalty_points', {
    p_points: points, p_subtotal: subtotal, p_delivery_cost: deliveryCost, p_discount_amount: discountAmount,
    p_order_id: orderId, p_idempotency_key: idempotencyKey, p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function releaseLoyaltyPoints(idempotencyKey, orderId = null) {
  const { data, error } = await supabase.rpc('release_loyalty_points', { p_idempotency_key: idempotencyKey, p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function reverseOrderLoyalty(orderId) {
  const { data, error } = await supabase.rpc('reverse_order_loyalty', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function adjustLoyaltyPoints({ userEmail, points, reason, userName = null }) {
  const { data, error } = await supabase.rpc('adjust_loyalty_points', {
    p_user_email: userEmail, p_points: points, p_reason: reason, p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

export async function setWalletStatus({ status, walletId = null, userEmail = null, reason = null }) {
  const { data, error } = await supabase.rpc('set_wallet_status', {
    p_status: status, p_wallet_id: walletId, p_user_email: userEmail, p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function loyaltyDashboardStats() {
  const { data, error } = await supabase.rpc('loyalty_dashboard_stats');
  if (error) throw error;
  return data;
}

export async function adminLoyaltyWallet(userEmail, limit = 50) {
  const { data, error } = await supabase.rpc('admin_loyalty_wallet', { p_user_email: userEmail, p_limit: limit });
  if (error) throw error;
  return data;
}
