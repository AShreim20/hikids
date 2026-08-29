// Direct-insert audit logging for Edge Functions that already run as service
// role and don't need the extra round trip through the logAuditActivity
// function. Mirrors that function's field truncation limits exactly.
export async function logAudit(service, {
  actor_id, action, actor_email, actor_role, target_type, target_id, details,
}) {
  await service.from('audit_logs').insert({
    action: String(action || '').slice(0, 120),
    actor_id: actor_id || '',
    actor_email: actor_email || '',
    actor_role: actor_role || '',
    target_type: String(target_type || '').slice(0, 60),
    target_id: String(target_id || '').slice(0, 120),
    details: String(details || '').slice(0, 1000),
  }).then(() => {}, () => {}); // best-effort, never blocks the caller
}
