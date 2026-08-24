import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Tag, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';

const SLIDE_MS = 3500;

export default function SaleBanner() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const { t, formatPrice, lang } = useLanguage();

  useEffect(() => {
    base44.entities.Product.list('-updated_date', 50)
      .then((products) => {
        const onSale = products.filter((p) => p.sale_price != null && p.sale_price < p.price);
        setItems(onSale);
      })
      .catch(() => setItems([]));
  }, []);

  const next = useCallback(() => setIndex((i) => (i + 1) % Math.max(items.length, 1)), [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(next, SLIDE_MS);
    return () => clearInterval(t);
  }, [next, items.length]);

  if (items.length === 0) return null;

  const current = items[index] || items[0];
  const off = Math.round((1 - current.sale_price / current.price) * 100);

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-accent text-white">
        {items.map((p, i) => (
          <div
            key={p.id}
            className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          >
            <Image src={p.image_url} alt={p.name} fittingType="fill" className="absolute inset-0 w-full h-full object-cover opacity-25" />
          </div>
        ))}
        <div className="relative grid sm:grid-cols-[1fr_auto] items-center gap-6 p-6 sm:p-10">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-xs font-heading font-bold uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5" /> {t('sb.onSale')} · {off}%
            </span>
            <h2 className="mt-4 font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-balance">{current.name}</h2>
            <p className="mt-2 text-white/90">{lang === 'ar' ? 'مفضّل موسمي، الآن بأقل.' : 'A seasonal favourite, now treasured for less.'}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="font-heading font-extrabold text-3xl">{formatPrice(current.sale_price)}</span>
              <span className="text-lg line-through text-white/70">{formatPrice(current.price)}</span>
            </div>
            <Link
              to={`/product/${current.id}`}
              className="mt-6 squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-white text-accent font-heading font-bold hover:bg-cosmic hover:text-white transition-colors"
            >
              {t('sb.shop')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {items.length > 1 && (
            <div className="hidden sm:flex items-center gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                  aria-label={`Deal ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}