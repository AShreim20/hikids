// Vercel Edge Middleware — the smallest change compatible with this project
// that makes per-product Open Graph/Twitter/JSON-LD previews reliable.
//
// Why this exists: HiKids is a pure client-side React SPA (plain `vite
// build`, no SSR/prerendering). Facebook, WhatsApp, Twitter/X, Slack, and
// most other link-preview crawlers do not execute JavaScript, so updating
// document.title/<meta> from React (see src/hooks/useDocumentMeta.js) is
// invisible to them — they only ever see index.html's static tags, which
// are necessarily generic (one file, every route). A real per-product
// preview requires the SERVER to return different HTML for a bot request to
// /product/<id> than for a browser request to the same URL.
//
// This middleware does exactly that and nothing else: it runs only on
// /product/:id, and only for a small, explicit list of known crawler user
// agents (this technique is Google's own documented "dynamic rendering"
// pattern, not a hack — it's also the reason Googlebot is included here
// rather than left to rely on its JS renderer, which is slower and not
// guaranteed). Every other request (i.e. every real visitor) falls through
// completely untouched to the normal SPA — zero behavior change for
// customers, and this file cannot affect checkout, cart, images, or any
// other already-shipped batch since it never runs for a browser.
//
// No framework migration, no SSR for the whole app — just a few KB of edge
// code for the one case (bots on product URLs) that genuinely needs it.

import { buildProductSeo } from './src/lib/productSeo.js';

export const config = {
  matcher: ['/product/:id'],
};

// Deliberately explicit rather than a generic "contains the word bot" regex
// (which would also catch things like "Roblox" or misc scrapers we have no
// opinion about) — these are the crawlers that actually generate link
// previews or drive search indexing.
const BOT_UA_RE =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|Slackbot|LinkedInBot|TelegramBot|Discordbot|Pinterest|redditbot|vkShare|W3C_Validator|Googlebot|Google-InspectionTool|bingbot|Applebot|Yandex/i;

function siteUrl() {
  return (process.env.VITE_SITE_URL || 'https://example.com').replace(/\/$/, '');
}

async function fetchProduct(id) {
  const base = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!base || !key) return null;
  const res = await fetch(
    `${base}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=*`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

// Mirrors CategoryContext's discountPctFor()/the identical SQL lookup
// already used server-side in secure_order (0021_guest_checkout_stock_fix.sql:
// `select coalesce(c.discount_percent, 0) ... where c.name = ... and
// c.discount_active is true`) — same rule, read over REST instead of a
// Postgres function, not a different discount policy.
async function fetchCategoryDiscountPct(categoryName) {
  if (!categoryName) return 0;
  const base = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!base || !key) return 0;
  const res = await fetch(
    `${base}/rest/v1/categories?name=eq.${encodeURIComponent(categoryName)}&discount_active=eq.true&select=discount_percent`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return 0;
  const rows = await res.json();
  return Number(rows?.[0]?.discount_percent) || 0;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderHtml(seo) {
  const jsonLd = JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(seo.title)}</title>
<meta name="description" content="${escapeHtml(seo.description)}" />
<link rel="canonical" href="${escapeHtml(seo.canonical)}" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="HiKids" />
<meta property="og:title" content="${escapeHtml(seo.title)}" />
<meta property="og:description" content="${escapeHtml(seo.description)}" />
<meta property="og:url" content="${escapeHtml(seo.canonical)}" />
${seo.image ? `<meta property="og:image" content="${escapeHtml(seo.image)}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(seo.title)}" />
<meta name="twitter:description" content="${escapeHtml(seo.description)}" />
${seo.image ? `<meta name="twitter:image" content="${escapeHtml(seo.image)}" />` : ''}
<meta name="robots" content="index, follow" />
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
<h1>${escapeHtml(seo.title)}</h1>
${seo.image ? `<img src="${escapeHtml(seo.image)}" alt="${escapeHtml(seo.title)}" />` : ''}
<p>${escapeHtml(seo.description)}</p>
<p>${seo.availability === 'https://schema.org/InStock' ? 'In stock' : 'Out of stock'}</p>
<a href="${escapeHtml(seo.canonical)}">View on HiKids</a>
</body>
</html>`;
}

function notFoundHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Product not found | HiKids</title>
<meta name="robots" content="noindex" /></head>
<body><h1>Product not found</h1><a href="${escapeHtml(siteUrl())}/shop">Back to shop</a></body></html>`;
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_UA_RE.test(ua)) return; // real visitors get the normal SPA, untouched

  const id = new URL(request.url).pathname.split('/').pop();
  const product = await fetchProduct(id);
  if (!product) {
    return new Response(notFoundHtml(), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  const catPct = await fetchCategoryDiscountPct(product.category);
  const seo = buildProductSeo(product, { catDiscountPct: catPct, siteUrl: siteUrl(), lang: 'en' });
  return new Response(renderHtml(seo), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
