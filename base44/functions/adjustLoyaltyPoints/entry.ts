import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOrCreateWallet, postLedger } from '../../shared/loyalty.ts';
import { can } from '../../shared/permissions.ts';

// Staff/owner manual wallet actions: add points, remove points, freeze/unfreeze.
// A reason is mandatory for every balance change and is stored on the ledger.
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

    if (body.action === 'freeze' || body.action === 'unfreeze') {
      if (!can(user, 'loyalty.settings')) return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });
      await base44.asServiceRole.entities.LoyaltyAccount.update(wallet.id, { frozen: body.action === 'freeze' });
      return Response.json({ success: true, frozen: body.action === 'freeze' });
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
      type: 'adjust',
      reason,
      actor_email: user.email,
    });
    return Response.json({ success: true, balance: res.wallet.balance, points: delta });
  } catch (error) {
    const insufficient = error.code === 'insufficient';
    return Response.json(
      { success: false, message: insufficient ? 'Balance cannot go negative' : error.message },
      { status: insufficient ? 200 : 500 }
    );
  }
}