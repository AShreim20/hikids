import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadLoyaltySettings, TX } from '../../shared/loyalty.ts';
import { can } from '../../shared/permissions.ts';

// Programme-wide loyalty statistics for the admin dashboard.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    if (!can(user, 'loyalty.view')) return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });

    const settings = await loadLoyaltySettings(base44);
    const wallets = await base44.asServiceRole.entities.LoyaltyAccount.list('-created_date', 1000);
    const txs = await base44.asServiceRole.entities.LoyaltyTransaction.list('-created_date', 1000);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const stats = {
      wallets: (wallets || []).length,
      active_wallets: 0,
      in_circulation: 0,
      pending: 0,
      earned: 0,
      redeemed: 0,
      expired: 0,
      earned_this_month: 0,
      redeemed_this_month: 0,
      point_value: settings.loyalty_redeem_rate,
    };

    (wallets || []).forEach((w) => {
      const blocked = w.frozen || (w.status && w.status !== 'active');
      if (!blocked) stats.active_wallets += 1;
      stats.in_circulation += w.balance || 0;
      stats.pending += w.pending_points || 0;
      stats.earned += w.lifetime_earned || 0;
      stats.redeemed += w.lifetime_spent || 0;
      stats.expired += w.expired_points || 0;
    });

    (txs || []).forEach((t) => {
      const at = new Date(t.created_date || 0);
      if (at < monthStart) return;
      const earnType = t.type === TX.REWARD || t.type === TX.CREDIT || t.type === 'earn';
      const spendType = t.type === TX.REDEEM || t.type === 'redeem';
      if (earnType && t.points > 0) stats.earned_this_month += t.points;
      if (spendType && t.points < 0) stats.redeemed_this_month += -t.points;
    });

    return Response.json({ success: true, stats });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}