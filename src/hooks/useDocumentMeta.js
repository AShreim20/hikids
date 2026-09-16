import { useEffect } from 'react';

// No react-helmet or similar is installed — this is the smallest possible
// substitute: set document.title and upsert a handful of <meta>/<link> tags
// on mount/update, restore the previous title on unmount so navigating away
// (e.g. back to a page that sets its own title) never leaves a stale one.
//
// This benefits real browsers (tab titles) and any crawler that actually
// executes JS (Googlebot generally does, eventually) — it is NOT what makes
// Facebook/WhatsApp previews work, since those crawlers typically don't run
// JS at all. That problem is solved separately, server-side, for product
// pages only (see middleware.js) — this hook covers everything else
// (Shop/FAQ/About/Privacy/Terms/Bundles) plus reinforces ProductDetail's
// own tags for the browser tab and for Googlebot's dynamic renderer.
function upsertMeta(attr, key, content) {
  if (content == null) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * @param {object} opts
 * @param {string} [opts.title] - full <title>, e.g. "FAQ | HiKids"
 * @param {string} [opts.description]
 * @param {string} [opts.canonical] - absolute URL
 * @param {string} [opts.image] - absolute image URL for og:image/twitter:image
 * @param {'website'|'product'} [opts.type]
 * @param {boolean} [opts.noindex]
 * @param {object} [opts.jsonLd] - Schema.org object, JSON-stringified as-is
 */
export function useDocumentMeta({ title, description, canonical, image, type = 'website', noindex = false, jsonLd } = {}) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) {
      document.title = title;
      upsertMeta('property', 'og:title', title);
      upsertMeta('name', 'twitter:title', title);
    }
    if (description != null && description !== '') {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:description', description);
      upsertMeta('name', 'twitter:description', description);
    }
    if (canonical) {
      upsertLink('canonical', canonical);
      upsertMeta('property', 'og:url', canonical);
    }
    if (image) {
      upsertMeta('property', 'og:image', image);
      upsertMeta('name', 'twitter:image', image);
    }
    upsertMeta('property', 'og:type', type);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    let script = null;
    if (jsonLd) {
      script = document.getElementById('product-jsonld');
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'product-jsonld';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      document.title = prevTitle;
      if (script) script.remove();
    };
  }, [title, description, canonical, image, type, noindex, jsonLd]);
}
