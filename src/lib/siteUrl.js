// Production origin — MUST be set as a real Vercel project env var
// (VITE_SITE_URL=https://www.hikids-ps.com). Falls back to a clearly-fake
// placeholder so canonical/OG URLs are never silently built on localhost or
// left blank when it's missing.
//
// The same env var name (VITE_SITE_URL) is read by middleware.js and
// api/sitemap.js / api/robots.js via `process.env` (Vercel injects every
// configured project env var into those runtimes regardless of the VITE_
// prefix — that prefix only controls what Vite inlines into the browser
// bundle). index.html's homepage tags are hardcoded to the same origin.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://example.com').replace(/\/$/, '');
