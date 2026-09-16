// Vercel Serverless Function, served at /sitemap.xml via vercel.json's
// rewrite. Generated on each request from live Supabase data (published
// products + currently-active bundles) rather than a static file, so the
// catalog growing never requires hand-editing a sitemap — see the SEO
// batch's task instructions ("do not create a sitemap architecture that
// requires manually editing sitemap.xml every time a product is added").
// A short cache-control lets Vercel's CDN absorb repeat crawler hits
// without re-querying Supabase on every single request.
import { isBundleActive } from '../src/lib/bundles.js';

const STATIC_PATHS = ['/', '/shop', '/bundles', '/about', '/faq', '/privacy', '/terms'];

async function fetchJson(url, key) {
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return [];
  return res.json();
}

function urlEntry(loc) {
  return `  <url><loc>${loc}</loc></url>`;
}

export default async function handler(req, res) {
  const siteUrl = (process.env.VITE_SITE_URL || 'https://example.com').replace(/\/$/, '');
  const base = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  const urls = STATIC_PATHS.map((p) => `${siteUrl}${p}`);

  if (base && key) {
    // Only published products — RLS already hides drafts from this anon-key
    // read, but the explicit filter keeps the query's intent obvious and
    // safe even if that policy ever changes.
    const products = await fetchJson(
      `${base}/rest/v1/products?status=eq.published&select=id`,
      key
    );
    for (const p of products) urls.push(`${siteUrl}/product/${p.id}`);

    const bundles = await fetchJson(
      `${base}/rest/v1/bundles?active=eq.true&select=id,active,start_date,end_date`,
      key
    );
    for (const b of bundles) {
      if (isBundleActive(b)) urls.push(`${siteUrl}/bundles/${b.id}`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(urlEntry)
    .join('\n')}\n</urlset>`;

  res.setHeader('content-type', 'application/xml; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=1800');
  res.status(200).send(xml);
}
