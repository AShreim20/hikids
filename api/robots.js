// Vercel Serverless Function, served at /robots.txt via vercel.json's
// rewrite. Dynamic (not a static public/robots.txt file) purely so the
// Sitemap: line always reflects the real VITE_SITE_URL env var once it's
// set, rather than needing a manual edit the day the domain is registered.
import { PRIVATE_PATH_PREFIXES } from '../src/lib/seoPaths.js';

export default function handler(req, res) {
  const siteUrl = (process.env.VITE_SITE_URL || 'https://example.com').replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PATH_PREFIXES.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ];
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=3600');
  res.status(200).send(lines.join('\n'));
}
