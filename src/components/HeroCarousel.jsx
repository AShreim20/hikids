import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/api/entities';
import { useLanguage } from '@/context/LanguageContext';
import { isSlidePubliclyVisible } from '@/lib/heroVisibility';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import HeroSlideMedia from '@/components/HeroSlideMedia';
import HeroSlideContent from '@/components/HeroSlideContent';
import HeroSlideTextCompact from '@/components/HeroSlideTextCompact';

// Large framed Hero carousel. Reuses the existing hero_slides table/entity —
// no second slide system — and the existing "no active slides → fall back to
// featured products" behavior, now producing a slide shaped the same way a
// real hero_slides row is (content_position/duration/etc. all get sane
// defaults) so HeroSlideContent/HeroSlideMedia don't need to special-case it.
const FALLBACK_SLIDE_DEFAULTS = {
  media_type: 'image', content_position: 'right', vertical_position: 'center',
  overlay_strength: 'medium', text_color: 'auto', focal_position: 'center',
  duration_seconds: 5, video_duration_mode: 'custom',
};

const isMobileViewportNow = () => typeof window !== 'undefined' && window.innerWidth < 768;

export default function HeroCarousel({ compact = false }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const [rawSlides, setRawSlides] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [hovering, setHovering] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  // Lazily resolved once on mount, synchronously, so the very first paint
  // already picks the right (desktop vs mobile) media for slide 1 — no
  // flash, no double-fetch. Kept in sync on resize for later slides/rotation.
  const [isMobileViewport, setIsMobileViewport] = useState(isMobileViewportNow);
  const reducedMotion = usePrefersReducedMotion();
  const touchStart = useRef(null);

  useEffect(() => {
    db.HeroSlide.list('sort_order', 20)
      .then((rows) => setRawSlides(rows || []))
      .catch(() => setRawSlides([]));
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobileViewport(isMobileViewportNow());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-evaluates who's currently eligible (Active + schedule window) once a
  // minute — cheap local date math, not a refetch — so a slide whose
  // schedule just ended doesn't linger visible indefinitely on a homepage
  // tab someone left open (point 51: "must not remain stale for an
  // unreasonable amount of time").
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const slides = useMemo(() => {
    const eligible = rawSlides.filter((s) => s.active !== false && s.image_url && isSlidePubliclyVisible(s, now));
    if (eligible.length) return eligible;
    return null; // signals "fetched, but nothing eligible — use the product fallback"
  }, [rawSlides, now]);

  const [fallbackSlides, setFallbackSlides] = useState(null);
  useEffect(() => {
    if (slides !== null) return; // real slides exist, never need the fallback
    db.Product.list('-updated_date', 20)
      .then((products) => {
        const featured = products.filter((p) => p.featured || (p.sale_price != null && p.sale_price < p.price));
        const picks = (featured.length ? featured : products).slice(0, 5);
        setFallbackSlides(picks.map((p) => ({
          ...FALLBACK_SLIDE_DEFAULTS,
          id: p.id,
          title: p.name,
          subtitle: p.description,
          image_url: p.image_url,
          cta_label: t('hero.exploreCta'),
          cta_link: `/product/${p.id}`,
        })));
      })
      .catch(() => setFallbackSlides([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides === null]);

  const activeSlides = slides ?? fallbackSlides ?? [];

  // Manual navigation always lands on a real index and — because the timer
  // effect below keys off `index` — always gets its own fresh, full
  // duration; it can never inherit whatever time was left on the slide the
  // customer navigated away from.
  const goTo = useCallback((i) => {
    setIndex((cur) => {
      const n = activeSlides.length;
      if (!n) return 0;
      const next = ((i % n) + n) % n;
      setDir(next > cur || (cur === n - 1 && next === 0) ? 1 : -1);
      return next;
    });
  }, [activeSlides.length]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Clamp a stale index back in range if the slide list shrinks (e.g. a
  // schedule just ended) rather than reading past the end of the array.
  useEffect(() => {
    if (index >= activeSlides.length && activeSlides.length > 0) setIndex(0);
  }, [activeSlides.length, index]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const current = activeSlides[index];
  const paused = hovering || tabHidden;
  const isAutoVideo = current?.media_type === 'video' && current?.video_duration_mode === 'auto';

  // The timer itself: re-armed from zero every time `index` changes (manual
  // or automatic), and simply doesn't run at all for a video in "auto"
  // mode — that slide advances from the video's own onEnded instead — or
  // while paused/reduced-motion.
  useEffect(() => {
    if (reducedMotion || paused || activeSlides.length <= 1 || isAutoVideo || !current) return;
    const ms = Math.min(30, Math.max(2, Number(current.duration_seconds) || 5)) * 1000;
    const id = setTimeout(() => goTo(index + 1), ms);
    return () => clearTimeout(id);
  }, [index, current, paused, reducedMotion, isAutoVideo, activeSlides.length, goTo]);

  if (!activeSlides.length && compact) {
    return <div className="mx-4 mt-3 mb-5 aspect-[16/10] rounded-3xl bg-mist animate-pulse" />;
  }
  if (!activeSlides.length) {
    return (
      <div className="px-2 sm:px-3 md:px-4 mt-3 sm:mt-4 md:mt-6 mb-6 sm:mb-8 md:mb-10">
        <div className="w-full aspect-[4/5] h-auto min-h-[420px] max-h-[600px] sm:aspect-auto sm:h-[440px] lg:h-auto lg:aspect-[16/5] lg:min-h-[420px] lg:max-h-[620px] rounded-[1.75rem] sm:rounded-[2rem] bg-mist animate-pulse" />
      </div>
    );
  }

  const s = current;

  // Minimal native touch-swipe — the Hero has no existing gesture library
  // wired in to reuse (the shadcn ui/carousel.jsx wrapper isn't used here),
  // so this is the one bit of "custom touch logic" that's actually needed.
  // A generous horizontal threshold and an early bail on vertical drags
  // keeps page-scrolling and CTA taps unaffected.
  const onTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) next(); else prev();
  };

  // Mobile homepage: one compact slide (artwork uncropped) with its copy
  // BELOW it, so text never covers the artwork.
  if (compact) {
    return (
      <section className="px-4 mt-3 mb-5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden bg-mist shadow-[0_16px_40px_-24px_rgba(93,63,133,0.5)]">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={s.id ?? index}
              className="absolute inset-0"
              initial={reducedMotion ? false : { opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -dir * 24 }}
              transition={{ duration: reducedMotion ? 0.2 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <HeroSlideMedia slide={s} isMobileViewport={isMobileViewport} eager={index === 0} contain onVideoEnded={isAutoVideo ? next : undefined} />
            </motion.div>
          </AnimatePresence>
          {activeSlides.length > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {activeSlides.map((_, i) => (
                <button key={i} onClick={() => goTo(i)} aria-label={ar ? `الانتقال إلى الشريحة ${i + 1}` : `Go to slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all shadow-sm ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
          )}
        </div>
        <HeroSlideTextCompact slide={s} exploreCtaLabel={t('hero.exploreCta')} />
      </section>
    );
  }

  return (
    <section
      className="px-2 sm:px-3 md:px-4 mt-3 sm:mt-4 md:mt-6 mb-6 sm:mb-8 md:mb-10"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Three independently-tuned tiers, each genuinely aspect-ratio-driven
          rather than a viewport-height guess, so any uploaded media — video
          or image, any native resolution — gets cropped into the *same*
          shape at a given breakpoint instead of the frame's own proportions
          drifting with device width:
            - Mobile (base, <sm): 4:5 portrait (the "1080×1350" reference),
              bounded to [420px, 600px]. Previously a flat h-[380px]
              regardless of width, so on a wider phone the frame drifted
              toward square/landscape instead of staying portrait.
            - Tablet (sm, 640–1023): untouched fixed 440px — already correct,
              left exactly as it was.
            - Desktop (lg+, 1024+): 16:5 wide banner (the "1920×600"
              reference), bounded to [420px, 620px]. This is the HERO
              DISPLAY ratio only — an uploaded video's own native ratio
              (e.g. 16:9) is never used to size this container; see
              HeroSlideMedia for how a mismatched video is shown in full
              (contain) with a blurred cover fill behind it instead of
              stretching/cropping to fit this shape.
          `w-full` is required here: with an auto width, the CSS
          `aspect-ratio` + `min-height` combo lets the browser solve WIDTH
          from the (min-height-clamped) height instead of the available
          space whenever the natural 16:5 height would fall under 420px —
          which happens at every desktop width from 1024 up to ~1390px,
          producing a container pinned to a fixed 1344px width regardless
          of viewport and overflowing the page (confirmed via
          getBoundingClientRect at 1024/1100/1366 before this fix). Pinning
          width to 100% up front makes height the only thing min/max-height
          can clamp. */}
      <div
        className="relative w-full aspect-[4/5] h-auto min-h-[420px] max-h-[600px] sm:aspect-auto sm:h-[440px] lg:h-auto lg:aspect-[16/5] lg:min-h-[420px] lg:max-h-[620px] rounded-[1.75rem] sm:rounded-[2rem] overflow-hidden bg-mist shadow-[0_20px_60px_-24px_rgba(93,63,133,0.45)]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={s.id ?? index}
            className="absolute inset-0"
            initial={reducedMotion ? false : { opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -dir * 24 }}
            transition={{ duration: reducedMotion ? 0.2 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroSlideMedia
              slide={s}
              isMobileViewport={isMobileViewport}
              eager={index === 0}
              onVideoEnded={isAutoVideo ? next : undefined}
            />
            <HeroSlideContent slide={s} exploreCtaLabel={t('hero.exploreCta')} />
          </motion.div>
        </AnimatePresence>

        {activeSlides.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label={ar ? 'الشريحة السابقة' : 'Previous slide'}
              className="hidden sm:grid absolute left-4 top-1/2 -translate-y-1/2 place-items-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white/90 hover:bg-white/25 transition-colors squish"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label={ar ? 'الشريحة التالية' : 'Next slide'}
              className="hidden sm:grid absolute right-4 top-1/2 -translate-y-1/2 place-items-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white/90 hover:bg-white/25 transition-colors squish"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2">
              {activeSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={ar ? `الانتقال إلى الشريحة ${i + 1}` : `Go to slide ${i + 1}`}
                  className={`h-1.5 sm:h-2 rounded-full transition-all shadow-sm ${
                    i === index ? 'w-6 sm:w-8 bg-white' : 'w-1.5 sm:w-2 bg-white/50 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
