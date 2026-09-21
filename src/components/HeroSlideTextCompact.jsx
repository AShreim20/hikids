import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Mobile hero copy: short headline, short description and ONE primary CTA,
// shown beneath the artwork (never over it). A CTA saved as an absolute
// same-site / localhost URL (e.g. http://localhost:5173/shop) is turned into
// its in-app path so it never leaves the site or breaks in production.
export function toInternalPath(url) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin === window.location.origin || u.hostname === 'localhost') return `${u.pathname}${u.search}${u.hash}`;
  } catch { /* keep as-is */ }
  return url;
}

export default function HeroSlideTextCompact({ slide, exploreCtaLabel }) {
  const link = toInternalPath(slide.cta_link);
  const internal = (link || '').startsWith('/');
  const Tag = internal ? Link : 'a';
  const dest = internal ? { to: link } : { href: link };
  return (
    <div className="mt-3 px-1">
      {slide.title && <h1 className="font-heading font-extrabold text-xl leading-tight line-clamp-2 whitespace-pre-line">{slide.title}</h1>}
      {slide.subtitle && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{slide.subtitle}</p>}
      {link && (
        <Tag {...dest} className="squish mt-3 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-cosmic text-white font-heading font-bold text-sm">
          {slide.cta_label || exploreCtaLabel} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </Tag>
      )}
    </div>
  );
}
