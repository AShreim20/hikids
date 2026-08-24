import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOrCreateWallet, postLedger, TX } from '../../shared/loyalty.ts';
import { can } from '../../shared/permissions.ts';

// Manual staff wallet actions: credit points, debit points, change wallet status.
// A reason is mandatory for every balance change and is stored on the ledger —
// staff can never change a balance silently.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.user_email || '').trim();
    if (!email) return Response.json({ success: false, message: 'user_email required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: email });
    let wallet = rows && rows[0];
    if (!wallet) wallet = await getOrCreateWallet(base44, { id: '', email, full_name: body.user_name || '' });

    // Wallet status: active / frozen / suspended.
    if (body.status) {
      if (!can(user, 'loyalty.settings')) return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
      const status = ['active', 'frozen', 'suspended'].includes(body.status) ? body.status : 'active';
      await base44.asServiceRole.entities.LoyaltyAccount.update(wallet.id, {
        status,
        frozen: status !== 'active',
      });
      await base44.functions.invoke('logAuditActivity', {
        action: `loyalty.wallet_${status}`,
        target_type: 'loyalty_wallet',
        target_id: wallet.id,
        details: email,
      }).catch(() => {});
      return Response.json({ success: true, status });
    }

    const delta = Math.trunc(Number(body.points) || 0);
    if (!delta) return Response.json({ success: false, message: 'points required' }, { status: 400 });
    const perm = delta > 0 ? 'loyalty.add' : 'loyalty.remove';
    if (!can(user, perm)) return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });

    const reason = String(body.reason || '').trim();
    if (!reason) return Response.json({ success: false, message: 'A reason is required' });

    const res = await postLedger(base44, {
      wallet,
      points: delta,
      type: delta > 0 ? TX.CREDIT : TX.DEBIT,
      reason,
      actor_email: user.email,
    });
    await base44.functions.invoke('logAuditActivity', {
      action: delta > 0 ? 'loyalty.credit' : 'loyalty.debit',
      target_type: 'loyalty_wallet',
      target_id: wallet.id,
      details: `${email}: ${delta > 0 ? '+' : ''}${delta} — ${reason}`,
    }).catch(() => {});
    return Response.json({ success: true, balance: res.wallet.balance, points: delta });
  } catch (error) {
    const insufficient = error.code === 'insufficient';
    return Response.json(
      { success: false, message: insufficient ? 'Balance cannot go negative' : error.message },
      { status: insufficient ? 200 : 500 }
    );
  }
}