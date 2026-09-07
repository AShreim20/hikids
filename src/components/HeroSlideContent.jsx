import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Content Position / Vertical Position are a property of the SLIDE's media
// composition (where the product sits in the photo), never of the page's
// text direction — "left" must stay physically left whether the customer is
// in Arabic or English. CSS flexbox/grid's own logical start/end shift with
// `dir`, which is exactly wrong here, so this deliberately uses raw
// physical `left`/`right`/`top`/`bottom` + `text-align: left|right` (which,
// unlike `text-align: start/end`, never flips) instead of Tailwind's usual
// start-*/end-* utilities.
const OVERLAY_ALPHA = { none: 0, light: 0.25, medium: 0.48, strong: 0.72 };

function overlayGradient(hPos, strength) {
  const a = OVERLAY_ALPHA[strength] ?? OVERLAY_ALPHA.medium;
  if (!a) return 'none';
  const dark = `rgba(18, 10, 36, ${a})`;
  const clear = 'rgba(18, 10, 36, 0)';
  if (hPos === 'left') return `linear-gradient(to right, ${dark} 0%, ${dark} 38%, ${clear} 82%)`;
  if (hPos === 'right') return `linear-gradient(to left, ${dark} 0%, ${dark} 38%, ${clear} 82%)`;
  return `radial-gradient(ellipse 70% 90% at center, ${dark} 0%, ${clear} 75%)`;
}

function contentBoxStyle(hPos, vPos) {
  const style = { position: 'absolute', maxWidth: '34rem', width: 'calc(100% - 3rem)' };
  const transforms = [];
  if (hPos === 'left') { style.left = '5%'; style.textAlign = 'left'; }
  else if (hPos === 'right') { style.right = '5%'; style.textAlign = 'right'; }
  else { style.left = '50%'; transforms.push('translateX(-50%)'); style.textAlign = 'center'; }
  if (vPos === 'top') { style.top = '9%'; }
  else if (vPos === 'bottom') { style.bottom = '8%'; }
  else { style.top = '50%'; transforms.push('translateY(-50%)'); }
  if (transforms.length) style.transform = transforms.join(' ');
  return style;
}

// 'auto' always resolves to light text: the gradient behind the content
// (overlayGradient above) already exists specifically to keep it readable
// over any photo, so white is the reliable choice; explicit Light/Dark let
// an admin override for a slide whose art direction calls for it.
const textColorClass = (v) => (v === 'dark' ? 'text-foreground' : 'text-white');

export default function HeroSlideContent({ slide, exploreCtaLabel }) {
  const hPos = slide.content_position || 'center';
  const vPos = slide.vertical_position || 'center';

  const primaryInternal = (slide.cta_link || '').startsWith('/');
  const PrimaryTag = primaryInternal ? Link : 'a';
  const primaryDest = primaryInternal ? { to: slide.cta_link } : { href: slide.cta_link };
  const secondaryInternal = (slide.secondary_cta_link || '').startsWith('/');
  const SecondaryTag = secondaryInternal ? Link : 'a';
  const secondaryDest = secondaryInternal ? { to: slide.secondary_cta_link } : { href: slide.secondary_cta_link };
  const hasSecondary = !!(slide.secondary_cta_link && slide.secondary_cta_label);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{ background: overlayGradient(hPos, slide.overlay_strength) }} />
      <div style={contentBoxStyle(hPos, vPos)} className={textColorClass(slide.text_color)}>
        {slide.title && (
          <h1 className="font-heading font-extrabold text-2xl sm:text-4xl md:text-5xl leading-[1.12] text-balance drop-shadow-lg whitespace-pre-line">
            {slide.title}
          </h1>
        )}
        {slide.subtitle && (
          <p className="mt-2.5 sm:mt-3 text-sm sm:text-base md:text-lg opacity-90 line-clamp-2 md:line-clamp-3">{slide.subtitle}</p>
        )}
        {(slide.cta_link || hasSecondary) && (
          <div className="mt-4 sm:mt-6 md:mt-7" style={{ textAlign: 'inherit' }}>
            <div className="inline-flex flex-wrap gap-3" style={{ textAlign: 'initial' }}>
              {slide.cta_link && (
                <PrimaryTag {...primaryDest} className="squish inline-flex items-center gap-2 h-11 sm:h-12 px-5 sm:px-7 rounded-full bg-cosmic text-white font-heading font-bold shadow-lg shadow-cosmic/30 whitespace-nowrap text-sm sm:text-base">
                  {slide.cta_label || exploreCtaLabel} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 rtl:rotate-180" />
                </PrimaryTag>
              )}
              {hasSecondary && (
                <SecondaryTag {...secondaryDest} className="squish inline-flex items-center h-11 sm:h-12 px-5 sm:px-7 rounded-full bg-white/15 backdrop-blur border border-white/30 text-white font-heading font-bold hover:bg-white hover:text-foreground transition-colors whitespace-nowrap text-sm sm:text-base">
                  {slide.secondary_cta_label}
                </SecondaryTag>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
