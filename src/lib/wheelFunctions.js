import { supabase } from '@/api/supabaseClient';

// Thin wrappers around the Postgres RPC functions from migration 0010 —
// these replace Base44's wheelState/wheelSpin/wheelGrantFirstSpin/
// finalizeWheelRewards/reverseWheelRewards functions. No Edge Function
// needed, same reasoning as orderFunctions.js/loyaltyFunctions.js.

export async function wheelState() {
  const { data, error } = await supabase.rpc('wheel_state');
  if (error) throw error;
  return data;
}

export async function wheelSpin() {
  const { data, error } = await supabase.rpc('wheel_spin');
  if (error) throw error;
  return data;
}

export async function wheelGrantFirstSpin() {
  const { data, error } = await supabase.rpc('wheel_grant_first_spin');
  if (error) throw error;
  return data;
}

export async function finalizeWheelRewards(orderId) {
  const { data, error } = await supabase.rpc('finalize_wheel_rewards', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function reverseWheelRewards(orderId) {
  const { data, error } = await supabase.rpc('reverse_wheel_rewards', { p_order_id: orderId });
  if (error) throw error;
  return data;
}
