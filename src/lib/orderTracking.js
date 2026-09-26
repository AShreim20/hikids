import { invokeFunction } from '@/lib/supabaseFunctions';

// Guest order tracking. Goes through the public trackOrder Edge Function (order
// number + checkout phone verified server-side, rate limited); the orders table
// itself is never readable by guests.
//
// Resolves { found: true, order } | { found: false, message }. Rejects with an
// Error (message already localized by the server, err.code set) for rate limits,
// invalid input and outages.
export function trackOrder(orderRef, phone, lang) {
  return invokeFunction('trackOrder', { order_ref: orderRef, phone, lang: lang === 'en' ? 'en' : 'ar' });
}
