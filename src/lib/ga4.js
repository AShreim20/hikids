// Google Analytics 4 — small, centralized, dependency-free integration.
// No Google Tag Manager: the project has no GTM container anywhere (checked
// before adding this), and a single gtag.js script is the smallest correct
// setup for one GA4 property.
//
// Production-only by design: the script is never injected outside a real
// production build running on the real hikids-ps.com origin, so localhost/
// dev/preview traffic can never reach the live property. `initGA()` is
// idempotent (an `initialized` module-level flag — ES modules are
// singletons, so this is genuinely "once per page load" with no extra
// bookkeeping) and safe to call from anywhere; every call after the first
// one is a no-op.
//
// The Measurement ID itself is not a secret (Google serves it to every
// visitor's browser by design) — read from VITE_GA_MEASUREMENT_ID so it's
// still one place to change, matching the project's existing VITE_ env
// convention (see siteUrl.js), rather than hardcoded here.
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

// import.meta.env.PROD is Vite's own "this is a real `vite build`" flag —
// true for the deployed site, false for `vite dev` and never set by a
// developer, so there's no separate flag to forget to flip before release.
// The hostname check is defense-in-depth on top of that: a production BUILD
// previewed locally (`vite preview`) or served from a Vercel preview/staging
// deployment still must not pollute the real property's data.
const PRODUCTION_HOSTNAMES = new Set(['www.hikids-ps.com', 'hikids-ps.com']);

function isRealProductionOrigin() {
  try {
    return import.meta.env.PROD && PRODUCTION_HOSTNAMES.has(window.location.hostname);
  } catch {
    return false;
  }
}

let initialized = false;
// Kept even when GA doesn't actually load (dev, non-prod host, missing ID)
// so gaEvent()/gaPageView() calls sprinkled through the app are always safe
// no-ops instead of every call site needing its own "is GA on?" check.
let active = false;

export const GA_CURRENCY = 'ILS';

export function initGA() {
  if (initialized) return;
  initialized = true;
  if (!MEASUREMENT_ID || !isRealProductionOrigin()) return;

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args) => window.dataLayer.push(args);
  window.gtag = gtag;
  gtag('js', new Date());
  // send_page_view: false — this app is a client-side-routed SPA, so page
  // views are sent explicitly on route change (see GAPageView.jsx) instead
  // of relying on gtag's own one-shot initial-load auto page_view, which
  // would otherwise double-count the very first page.
  gtag('config', MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true; // never blocks page rendering
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
  active = true;
}

// Every call site uses this (never window.gtag directly) so an analytics
// failure — GA blocked by the browser, ad-blocker, offline, gtag.js failing
// to load — can never throw into and break real shopping/checkout code.
export function gaEvent(name, params = {}) {
  if (!active) return;
  try {
    window.gtag?.('event', name, params);
  } catch { /* analytics must never break the app */ }
}

export function gaPageView(path, title) {
  try {
    gaEvent('page_view', {
      page_location: window.location.origin + path,
      page_path: path,
      page_title: title,
    });
  } catch { /* see gaEvent */ }
}

// Purchase deduplication — keyed on the order id (HiKids' own transaction_id),
// never on anything identifying the customer. sessionStorage (not
// localStorage): the concern is one browsing session re-sending the same
// order's purchase event (a refresh of the success screen, navigating away
// and back, React re-rendering) — it does not need to survive the tab
// closing, and clearing on tab close keeps it from growing unbounded across
// a shared/public device's lifetime. Also called from a single, one-shot,
// imperative point in Checkout.jsx's placeOrder() (never from a useEffect
// reacting to state) specifically so a React StrictMode double-invoke or a
// later re-render can't cause a second real fire even before this guard
// would kick in — this is the second, independent layer, not the only one.
const PURCHASED_KEY = 'hikids_ga_purchased_orders';

export function gaPurchaseOnce(orderId, params) {
  if (!orderId) return false;
  try {
    const fired = JSON.parse(sessionStorage.getItem(PURCHASED_KEY) || '[]');
    if (fired.includes(orderId)) return false;
    fired.push(orderId);
    sessionStorage.setItem(PURCHASED_KEY, JSON.stringify(fired.slice(-20)));
  } catch {
    // sessionStorage unavailable (private-mode edge case) — the one-shot
    // call site in Checkout.jsx is still the primary guard, so fall through
    // and send it once rather than silently dropping a real purchase.
  }
  gaEvent('purchase', { currency: GA_CURRENCY, ...params });
  return true;
}
