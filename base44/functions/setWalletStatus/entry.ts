import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { TX } from '../../shared/loyalty.ts';
import { can } from '../../shared/permissions.ts';

const STATUSES = ['active', 'frozen', 'suspended'];

// Freeze / unfreeze / suspend a customer wallet. The status is persisted on the
// wallet record and every change writes a zero-point ledger entry so the wallet
// activity log keeps the full history (who, when, from → to, why).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Please sign in again.' }, { status: 401 });
    if (!can(user, 'loyalty.settings')) {
      return Response.json(
        { success: false, message: 'You do not have permission to change this wallet status.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body.status || '').toLowerCase();
    if (!STATUSES.includes(status)) {
      return Response.json({ success: false, message: 'Invalid wallet status.' }, { status: 400 });
    }

    let wallet = null;
    if (body.wallet_id) {
      wallet = await base44.asServiceRole.entities.LoyaltyAccount.get(body.wallet_id).catch(() => null);
    } else if (body.user_email) {
      const rows = await base44.asServiceRole.entities.LoyaltyAccount.filter({
        user_email: String(body.user_email).trim(),
      });
      wallet = rows && rows[0] ? rows[0] : null;
    }
    if (!wallet) return Response.json({ success: false, message: 'Wallet not found.' }, { status: 404 });

    const current = wallet.status || (wallet.frozen ? 'frozen' : 'active');
    if (current === status) {
      return Response.json({
        success: false,
        message: status === 'active' ? 'This wallet is already active.' : `This wallet is already ${status}.`,
        wallet,
      });
    }

    const reason = String(body.reason || '').trim();
    const now = new Date().toISOString();
    const patch = { status, frozen: status !== 'active', last_activity_at: now };
    await base44.asServiceRole.entities.LoyaltyAccount.update(wallet.id, patch);
    const updated = { ...wallet, ...patch };

    // Zero-point audit entry — the balance is never touched by a status change.
    await base44.asServiceRole.entities.LoyaltyTransaction.create({
      account_id: wallet.id,
      wallet_code: wallet.wallet_code || '',
      user_id: wallet.user_id || '',
      user_email: wallet.user_email,
      points: 0,
      type: TX.ADJUSTMENT,
      status: 'completed',
      reason: `Wallet ${status} (was ${current})${reason ? ` — ${reason}` : ''}`,
      balance_before: wallet.balance || 0,
      balance_after: wallet.balance || 0,
      actor_email: user.email,
    }).catch(() => {});

    await base44.functions.invoke('logAuditActivity', {
      action: `loyalty.wallet_${status}`,
      target_type: 'loyalty_wallet',
      target_id: wallet.id,
      details: `${wallet.user_email}: ${current} → ${status}${reason ? ` — ${reason}` : ''}`,
    }).catch(() => {});

    return Response.json({ success: true, status, previous_status: current, wallet: updated });
  } catch (error) {
    return Response.json(
      { success: false, message: error.message || 'Wallet status could not be updated.' },
      { status: 500 },
    );
  }
}