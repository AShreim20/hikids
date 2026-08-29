import { supabase } from '@/api/supabaseClient';

// Thin wrappers around the Postgres RPC functions added in migration 0008 —
// these replace Base44's secureOrder/commitOrderStock/redeemDiscount
// functions. No Edge Function needed: each is a SECURITY DEFINER Postgres
// function that reads auth.uid()/auth.jwt() from the caller's own request
// (PostgREST forwards it, just like an Edge Function's
// createClientFromRequest(req) did) to do its own ownership check, then
// bypasses RLS internally. Each already returns the same jsonb shape the
// Base44 functions returned after unwrap(), so callers use the result as-is.
export async function secureOrder(orderId) {
  const { data, error } = await supabase.rpc('secure_order', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function commitOrderStock(orderId) {
  const { data, error } = await supabase.rpc('commit_order_stock', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function redeemDiscount(codeId, orderId) {
  const { data, error } = await supabase.rpc('redeem_discount', { p_code_id: codeId, p_order_id: orderId });
  if (error) throw error;
  return data;
}
