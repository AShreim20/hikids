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
};
