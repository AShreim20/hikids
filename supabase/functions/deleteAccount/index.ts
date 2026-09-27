import { callerClient, getCallerUser } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Self-service account deletion. Delegates entirely to the self_delete_account
// RPC (same migration as admin_delete_user_account): it always operates on
// auth.uid() from the caller's own JWT, so a customer can only ever delete
// themselves, never another account. That RPC disowns/anonymizes every
// historical reference (orders, loyalty, reviews, returns, wallet, wheel,
// challenges) via the SAME shared cleanup helper the admin path uses, then
// deletes the auth.users row — no service-role bypass, no separate cleanup
// logic duplicated here.
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const user = await getCallerUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await callerClient(req).rpc('self_delete_account');
    if (error) throw error;
    if (!data?.success) return json({ error: data?.message || 'Could not delete account' }, { status: 400 });
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
