import { supabase } from '@/api/supabaseClient';

// Mirrors base44.functions.invoke(name, body)'s throw-on-error behavior
// (Supabase's functions.invoke returns { data, error } instead of throwing),
// so existing try/catch call sites keep working unchanged. Returns the
// function's JSON body directly (no separate unwrap() needed).
export async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      const payload = await error.context?.json();
      message = payload?.message || payload?.error || message;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return data;
}
