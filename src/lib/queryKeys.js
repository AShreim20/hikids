// Central query-key builders for every React Query cache in the app.
//
// Rules (see the caching/freshness audit for the full reasoning):
// - Keys must fully represent the request — two different filter/page/user
//   combinations must never collide under one key.
// - Anything user-specific (cart validation, loyalty, wallet, favorites,
//   rewards, challenges, notifications, account) is keyed by userId so one
//   customer's cached data can never surface for another — see
//   clearUserQueries() below, called on logout.
export const queryKeys = {
  products: (filters) => ['products', filters],
  // Shared by every homepage section that just wants "the recent catalog" —
  // Recommendations, SaleBanner and HeroCarousel's fallback all used to each
  // fire their own db.Product.list('-updated_date', 50) on every home page
  // load; one shared key lets React Query de-dupe and cache that into a
  // single request.
  recentProducts: (limit) => ['recent-products', limit],
  product: (id) => ['product', id],
  productCommercial: (id) => ['product-commercial', id],
  categories: () => ['categories'],
  homeContent: () => ['home-content'],
  siteSettings: () => ['site-settings'],
  loyalty: (userId) => ['loyalty', userId],
  wallet: (userId) => ['wallet', userId],
  rewards: (userId) => ['rewards', userId],
  challenges: (userId) => ['challenges', userId],
  favorites: (userId) => ['favorites', userId],
  notifications: (userId) => ['notifications', userId],
  account: (userId) => ['account', userId],
};

// Every key namespace that carries data scoped to a signed-in user. Wipe
// these from the cache on logout so the next sign-in (a different account on
// the same device/tab) can never read a stale, previous user's cached values.
const USER_SCOPED_ROOTS = ['loyalty', 'wallet', 'rewards', 'challenges', 'favorites', 'notifications', 'account'];

export function clearUserScopedQueries(queryClient) {
  for (const root of USER_SCOPED_ROOTS) {
    queryClient.removeQueries({ queryKey: [root] });
  }
}
