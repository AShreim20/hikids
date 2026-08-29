import { callerClient, getCallerUser, serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

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

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').slice(0, 120);
    if (!action) return json({ error: 'action is required' }, { status: 400 });

    const record = {
      action,
      actor_id: user.id,
      actor_email: user.email || '',
      actor_role: profile?.role || 'user',
      target_type: String(body.target_type || '').slice(0, 60),
      target_id: String(body.target_id || '').slice(0, 120),
      details: String(body.details || '').slice(0, 1000),
    };

    // Service role bypasses RLS; the caller's identity is taken from the
    // authenticated token so the actor cannot be forged.
    const { error } = await serviceRoleClient().from('audit_logs').insert(record);
    if (error) throw error;
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
