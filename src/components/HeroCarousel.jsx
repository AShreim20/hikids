import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';

const SLIDE_MS = 5500;

export default function HeroCarousel() {
  const { t } = useLanguage();
  const [slides, setSlides] = useState([]);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    base44.entities.HeroSlide.list('sort_order', 20).
    then((rows) => {
      const active = (rows || []).filter((s) => s.active !== false && s.image_url);
      if (active.length) {setSlides(active);return;}
      return base44.entities.Product.list('-updated_date', 20).then((products) => {
        const featured = products.filter((p) => p.featured || p.sale_price != null && p.sale_price < p.price);
        const picks = (featured.length ? featured : products).slice(0, 5);
        setSlides(picks.map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: p.description,
          image_url: p.image_url,
          cta_label: t('hero.exploreCta'),
          cta_link: `/product/${p.id}`
        })));
      });
    }).
    catch(() => setSlides([]));
  }, []);

  const go = useCallback((n) => {
    setDir(n > 0 ? 1 : -1);
    setIndex((i) => (i + n + slides.length) % Math.max(slides.length, 1));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => go(1), SLIDE_MS);
    return () => clearInterval(timer);
  }, [go, slides.length]);

  if (!slides.length) {
    return <div className="w-full h-[62vh] min-h-[380px] bg-mist animate-pulse" />;
  }

  const s = slides[index] || slides[0];
  const isInternal = (s.cta_link || '').startsWith('/');

  return (
    <section className="relative w-full h-[62vh] min-h-[420px] max-h-[760px] overflow-hidden bg-mist">
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.08, x: dir * 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
          
          <Image src={s.image_url} alt={s.title || 'slide'} fittingType="fill" className="w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        </motion.div>
      </AnimatePresence>

      <div className="relative h-full max-w-7xl mx-auto px-5 sm:px-8 flex flex-col justify-end pb-14 md:pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${index}`}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.15 }}
            className="max-w-2xl text-white">
            
            {s.title &&
            <h1 className="font-heading font-extrabold text-4xl sm:text-5xl md:text-6xl leading-[1.05] text-balance drop-shadow">
                {s.title}
              </h1>
            }
            {s.subtitle &&
            <p className="mt-4 text-base md:text-xl text-white/85 line-clamp-3">{s.subtitle}</p>
            }
            <div className="mt-7 flex flex-wrap gap-3">
              {s.cta_link ?
              isInternal ?
              <Link to={s.cta_link} className="squish inline-flex items-center gap-2 min-h-12 px-7 rounded-full bg-cosmic text-white font-heading font-bold shadow-lg shadow-cosmic/30">
                    {s.cta_label || t('hero.exploreCta')} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                  </Link> :

              <a href={s.cta_link} className="squish inline-flex items-center gap-2 min-h-12 px-7 rounded-full bg-cosmic text-white font-heading font-bold shadow-lg shadow-cosmic/30">
                    {s.cta_label || t('hero.exploreCta')} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                  </a> :


              <a href="#explore" className="squish inline-flex items-center gap-2 min-h-12 px-7 rounded-full bg-cosmic text-white font-heading font-bold shadow-lg shadow-cosmic/30">
                  {t('hero.exploreCta')} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                </a>
              }
              <a href="#categories" className="squish inline-flex items-center min-h-12 px-7 rounded-full bg-white/15 backdrop-blur text-white font-heading font-bold hover:bg-white hover:text-foreground transition-colors">
                {t('hero.worldsCta')}
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {slides.length > 1 &&
      <>
          <button
          onClick={() => go(-1)}
          aria-label="Previous slide"
          className="hidden sm:grid absolute left-4 top-1/2 -translate-y-1/2 place-items-center w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white hover:bg-white hover:text-foreground transition squish mx-10">
          
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
          onClick={() => go(1)}
          aria-label="Next slide"
          className="hidden sm:grid absolute right-4 top-1/2 -translate-y-1/2 place-items-center w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white hover:bg-white hover:text-foreground transition squish">
          
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, i) =>
          <button
            key={i}
            onClick={() => {setDir(i > index ? 1 : -1);setIndex(i);}}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-white' : 'w-2 bg-white/50'}`} />

          )}
          </div>
        </>
      }
    </section>);

}