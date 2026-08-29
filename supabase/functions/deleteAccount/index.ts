import { getCallerUser, serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const user = await getCallerUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
    // Deletes the auth.users row; the profiles row cascades via its FK.
    const { error } = await serviceRoleClient().auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
