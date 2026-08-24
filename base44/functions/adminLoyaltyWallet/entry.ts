import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { can } from '../../shared/permissions.ts';

// Staff view of a single customer wallet + its full ledger history.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });
    if (!can(user, 'loyalty.view')) return Response.json({ success: false, message: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.user_email || '').trim();
    if (!email) return Response.json({ success: false, message: 'user_email required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: email });
    const wallet = rows && rows[0] ? rows[0] : null;

    let transactions = [];
    if (can(user, 'loyalty.transactions.view')) {
      transactions = await base44.asServiceRole.entities.LoyaltyTransaction.filter(
        { user_email: email }, '-created_date', Math.min(Number(body.limit) || 50, 200)
      );
    }
    return Response.json({ success: true, wallet, transactions });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}