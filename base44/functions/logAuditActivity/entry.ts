import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'user') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').slice(0, 120);
    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    const record = {
      action,
      actor_id: user.id,
      actor_email: user.email || '',
      actor_role: user.role || '',
      target_type: String(body.target_type || '').slice(0, 60),
      target_id: String(body.target_id || '').slice(0, 120),
      details: String(body.details || '').slice(0, 1000),
    };

    // Service role bypasses RLS; the caller's identity is taken from the
    // authenticated token so the actor cannot be forged.
    await base44.asServiceRole.entities.AuditLog.create(record);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}