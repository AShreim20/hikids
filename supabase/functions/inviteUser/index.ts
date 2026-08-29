import { callerClient, getCallerUser, serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Invites a new staff/team member by email — replaces Base44's
// base44.users.inviteUser(email, 'user'). Admin-only: creates the auth.users
// row (handle_new_user() then auto-creates their profiles row, role
// defaulting to 'user') and sends Supabase's built-in invite email with a
// link to set a password. No new external credentials needed — this reuses
// the service-role key already configured for every other Edge Function.
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const user = await getCallerUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await callerClient(req)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') return json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return json({ error: 'email required' }, { status: 400 });

    const service = serviceRoleClient();
    const { data, error } = await service.auth.admin.inviteUserByEmail(email);
    if (error) return json({ error: error.message }, { status: 400 });

    return json({ success: true, user_id: data.user?.id });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
