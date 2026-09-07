import { QueryClient } from '@tanstack/react-query';

// App-wide defaults for CACHEABLE data (catalog/descriptive content — see
// the caching audit). Real-time/business-critical queries (cart validation,
// loyalty, wallet, rewards, product commercial state, coupons, checkout
// pricing, etc.) explicitly override staleTime to 0 and/or rely on Supabase
// Realtime + targeted invalidation instead of these defaults — they must
// never inherit a 5-minute-stale read.
//
// refetchOnWindowFocus stays false: tab-switching/minimizing must never
// trigger a refetch that could race with (and, before this was fixed
// elsewhere, did) overwrite a dirty admin form. Selective focus-based
// revalidation, where actually wanted for a real-time query, is opted into
// per-query, not globally.
export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 5 * 60 * 1000, // 5 minutes — matches the catalog/product default
			gcTime: 30 * 60 * 1000, // 30 minutes — how long an unused cache entry is kept
		},
	},
});