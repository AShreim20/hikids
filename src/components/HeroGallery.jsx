import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';

const SLIDE_MS = 4500;

export default function HeroGallery() {
  const [slides, setSlides] = useState([]);
  const [index, setIndex] = useState(0);
  const { formatPrice } = useLanguage();

  useEffect(() => {
    base44.entities.Product.list('-updated_date', 50).
    then((products) => {
      const featured = products.filter(
        (p) => p.featured || p.sale_price != null && p.sale_price < p.price
      );
      const picks = (featured.length >= 2 ? featured : products).slice(0, 6);
      setSlides(picks);
    }).
    catch(() => setSlides([]));
  }, []);

  const next = useCallback(
    () => setIndex((i) => (i + 1) % Math.max(slides.length, 1)),
    [slides.length]
  );
  const prev = () => setIndex((i) => (i - 1 + slides.length) % Math.max(slides.length, 1));

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(next, SLIDE_MS);
    return () => clearInterval(t);
  }, [next, slides.length]);

  if (slides.length === 0) {
    return <div className="relative aspect-square rounded-[3rem] bg-mist animate-pulse" />;
  }

  const current = slides[index] || slides[0];
  const onSale = current.sale_price != null && current.sale_price < current.price;

  return (
    <div className="relative aspect-square rounded-[3rem] overflow-hidden bg-mist shadow-[0_40px_80px_-30px_rgba(26,26,30,0.35)]">
      {slides.map((s, i) =>
      <Link
        key={s.id}
        to={`/product/${s.id}`}
        className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
          <Image src={s.image_url} alt={s.name} fittingType="fill" className="w-full h-full object-cover" />
        </Link>
      )}

      <div className="absolute hidden sm:block bg-card rounded-3xl px-6 py-4 shadow-xl -bottom-1 -left-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{onSale ? 'On Sale' : 'Featured'}</p>
        <p className="font-heading font-bold text-lg line-clamp-1 max-w-[10rem]">{current.name}</p>
        <p className="text-cosmic font-extrabold">{formatPrice(onSale ? current.sale_price : current.price)}</p>
      </div>

      {slides.length > 1 &&
      <>
          <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-card/80 backdrop-blur text-foreground hover:bg-card transition squish"
          aria-label="Previous slide">
          
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-card/80 backdrop-blur text-foreground hover:bg-card transition squish"
          aria-label="Next slide">
          
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) =>
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-cosmic' : 'w-1.5 bg-white/70'}`}
            aria-label={`Go to slide ${i + 1}`} />

          )}
          </div>
        </>
      }
    </div>);

}