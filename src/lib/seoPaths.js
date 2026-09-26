// Single source of truth for "this route is private/transactional and must
// not be indexed" — shared by api/robots.js (Disallow lines) and
// RouteMeta.jsx (client-side noindex meta), so the two never drift apart.
// Every account, cart/checkout, and staff/admin-adjacent route currently
// registered in App.jsx that isn't plain public storefront content.
export const PRIVATE_PATH_PREFIXES = [
  '/admin',
  '/cart',
  '/checkout',
  '/wishlist',
  '/orders',
  '/orders-admin',
  '/track-order',
  '/addresses',
  '/loyalty',
  '/loyalty-admin',
  '/wheel',
  '/wheel-rewards',
  '/rewards',
  '/challenges',
  '/share',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/analytics',
  '/staff',
  '/delivery',
  '/discounts',
];

export const isPrivatePath = (pathname) =>
  PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
