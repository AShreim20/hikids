// Production domain isn't registered yet (per the user, as of this SEO
// batch) — this MUST be set as a real Vercel project env var before launch.
// Falls back to a clearly-fake placeholder so canonical/OG URLs are never
// silently built on localhost or left blank in the meantime.
//
// The same env var name (VITE_SITE_URL) is read by middleware.js and
// api/sitemap.js / api/robots.js via `process.env` (Vercel injects every
// configured project env var into those runtimes regardless of the VITE_
// prefix — that prefix only controls what Vite inlines into the browser
// bundle) and by index.html via Vite's `%VITE_SITE_URL%` HTML replacement —
// one variable, three consumers, so it only needs to be set in one place.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://example.com').replace(/\/$/, '');
