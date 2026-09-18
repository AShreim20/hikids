import { createEntity } from './createEntity';

// Entities migrated off Base44, phase by phase. Keys match
// base44.entities.<Name> so call sites only need to swap the import
// (`base44.entities.Product` -> `db.Product`), not their logic.
export const db = {
  // Phase 1: public read-only catalog entities.
  Product: createEntity('products'),
  Category: createEntity('categories'),
  Bundle: createEntity('bundles'),
  HeroSlide: createEntity('hero_slides'),
  Setting: createEntity('settings'),
  SiteContent: createEntity('site_content'),
  SiteSetting: createEntity('site_settings'),
  WheelConfig: createEntity('wheel_config'),
  WheelReward: createEntity('wheel_rewards'),
  DeliveryCity: createEntity('delivery_cities'),
  Challenge: createEntity('challenges'),
  // Phase 2: user-owned addresses + admin audit log.
  Address: createEntity('addresses'),
  AuditLog: createEntity('audit_logs'),
  // Phase 3: product reviews (status-gated read; writes go through
  // submitPhotoReview/reviewPhoto for photo reviews, direct insert for text).
  Review: createEntity('reviews'),
  // Phase 4: admin-only discounts/suppliers/purchase orders. Ledger-moving
  // writes (posting/cancelling a PO, supplier payments) go through their
  // Edge Functions, not direct entity calls.
  DiscountCode: createEntity('discount_codes'),
  Supplier: createEntity('suppliers'),
  SupplierTransaction: createEntity('supplier_transactions'),
  PurchaseOrder: createEntity('purchase_orders'),
  // Pulled forward from Phase 8: replaces Base44's `User` entity. Admins can
  // read/update any row directly (profiles_read_own_or_admin /
  // profiles_update_own_or_admin RLS), so no Edge Function is needed here.
  Profile: createEntity('profiles'),
  // Phase 5: orders. Public INSERT (guest checkout), owner-or-admin SELECT,
  // admin-only UPDATE/DELETE. Financials/stock are never trusted from the
  // client — secure_order/commit_order_stock/redeem_discount (Postgres RPCs,
  // see src/lib/orderFunctions.js) are the only way totals or stock change.
  Order: createEntity('orders'),
  // Phase 6: loyalty. Owner-or-staff(loyalty.view) SELECT, admin-only direct
  // write (balances never change via a raw update from the client — every
  // mutation goes through the ledger RPCs in src/lib/loyaltyFunctions.js).
  LoyaltyAccount: createEntity('loyalty_accounts'),
  LoyaltyTransaction: createEntity('loyalty_transactions'),
  // Phase 7: wheel + challenges. Same pattern — owner-or-admin SELECT,
  // admin-only direct write; every reward-granting mutation goes through the
  // RPCs in src/lib/wheelFunctions.js / challengeFunctions.js instead.
  WheelProgress: createEntity('wheel_progress'),
  WheelSpin: createEntity('wheel_spins'),
  ChallengeProgress: createEntity('challenge_progress'),
  ChallengeSubmission: createEntity('challenge_submissions'),
  RewardHistory: createEntity('reward_history'),
  // Phase 8: operating expenses. permission-gated (expenses.view/expenses.manage)
  // rather than plain admin-only, so an owner can delegate bookkeeping to
  // staff. See src/lib/reports.js for how these feed the P&L.
  Expense: createEntity('expenses'),
  ExpenseCategory: createEntity('expense_categories'),
  // Phase 9 (Homepage Stage 5): Newsletter signups. Public INSERT only (guest
  // subscribe, no login needed) — no SELECT/UPDATE/DELETE for anon or
  // authenticated at all, so always call .create(payload, {returning:false})
  // like a guest order. Duplicate email/phone is rejected at the DB level by
  // a unique index, not by reading the list first.
  NewsletterSubscriber: createEntity('newsletter_subscribers'),
  // FAQ page question form: same public-insert-only shape as
  // NewsletterSubscriber above (always .create(payload, {returning:false})).
  // Only an admin can list/read/update — see CustomerInquiries.jsx.
  CustomerInquiry: createEntity('customer_inquiries'),
  // Returns & Exchanges, Phase 1 (foundation only — no submission/approval
  // workflow yet). ReturnReason is public-read/permission-write
  // ('returns.manage'), same shape as Category. ReturnRequest/
  // ReturnRequestItem are permission-gated for both read and write for now
  // — no customer-facing policy exists until Phase 2 adds one.
  ReturnReason: createEntity('return_reasons'),
  ReturnRequest: createEntity('return_requests'),
  ReturnRequestItem: createEntity('return_request_items'),
  // Phase 3: staff-only internal notes on a Return Request. No customer RLS
  // policy exists at all for this table (see migration 0033) — write only
  // via admin_add_internal_note(), never a direct .create().
  ReturnRequestNote: createEntity('return_request_notes'),
  // Phase 4: physical receiving/inspection event logs and the inventory
  // ledger they can produce. Same staff-only shape as ReturnRequestNote —
  // no customer RLS policy at all (migration 0034) — write only via
  // adminReceiveReturnItem()/adminInspectReturnItem(), never a direct
  // .create().
  ReturnRequestItemReceipt: createEntity('return_request_item_receipts'),
  ReturnRequestItemInspection: createEntity('return_request_item_inspections'),
  InventoryMovement: createEntity('inventory_movements'),
  // Phase 5: HiKids Wallet (monetary ₪ ledger, separate from Loyalty
  // Points) and the return financial-settlement/refund records. Wallet
  // balance and settlement/refund status only ever change via the RPCs in
  // src/lib/walletFunctions.js — wallets/wallet_transactions have no
  // INSERT/UPDATE RLS policy at all (migration 0035).
  Wallet: createEntity('wallets'),
  WalletTransaction: createEntity('wallet_transactions'),
  ReturnRefund: createEntity('return_refunds'),
  ReturnSettlement: createEntity('return_settlements'),
};
