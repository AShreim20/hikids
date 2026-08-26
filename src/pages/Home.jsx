import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Leaf, Truck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Recommendations from '@/components/Recommendations';
import HeroCarousel from '@/components/HeroCarousel';
import SaleBanner from '@/components/SaleBanner';
import Newsletter from '@/components/Newsletter';
import { useLanguage } from '@/context/LanguageContext';

// categories are built inside the component for i18n

export default function Home() {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const categories = ['build', 'plush', 'vehicles', 'early', 'pretend', 'arts'].map((k) => ({
    name: t(`cat.${k}`), desc: t(`cat.${k}Desc`), key: k
  }));
  const CAT_ENUM = {
    build: 'Build & Create', plush: 'Plush & Soft', vehicles: 'Vehicles & Motion',
    early: 'Early Years', pretend: 'Pretend Play', arts: 'Arts & Crafts'
  };
  const catImage = (key) => {
    const p = products.find((pr) => pr.category === CAT_ENUM[key]);
    return p?.image_url;
  };

  useEffect(() => {
    base44.entities.Product.list('-updated_date', 50).
    then(setProducts).
    catch(() => setProducts([])).
    finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero carousel */}
      <HeroCarousel />

      {/* Promise strip */}
      <section id="promise" className="border-y border-border/60 bg-mist/50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid sm:grid-cols-3 gap-8">
          {[
          { icon: Leaf, title: t('promise.sustain'), desc: t('promise.sustainDesc') },
          { icon: ShieldCheck, title: t('promise.pay'), desc: t('promise.payDesc') },
          { icon: Truck, title: t('promise.delivery'), desc: t('promise.deliveryDesc') }].
          map((p) =>
          <div key={p.title} className="flex items-center gap-4">
              <div className="grid place-items-center w-12 h-12 rounded-2xl bg-card shadow-sm">
                <p.icon className="w-6 h-6 text-cosmic" />
              </div>
              <div>
                <p className="font-heading font-bold">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <SaleBanner />

      {/* Categories */}
      <section id="categories" className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:py-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('cats.curateBy')}</p>
            <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('cats.title')}</h2>
          </div>
          <p className="text-muted-foreground max-w-sm">{t('cats.subtitle')}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 md:gap-6">
          {categories.map((c, i) => {
            const img = catImage(c.key);
            return (
              <Link
                key={c.name}
                to={`/shop?category=${encodeURIComponent(CAT_ENUM[c.key])}`}
                className="group relative overflow-hidden rounded-3xl bg-mist aspect-[4/3] sm:aspect-[5/3] flex flex-col justify-end squish float-in"
                style={{ animationDelay: `${i * 0.05}s` }}>
                
                {img ?
                <Image
                  src={img}
                  alt={c.name}
                  fittingType="fill"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.08]" /> :


                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-cosmic/20" />
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="relative p-4 sm:p-6 md:p-8 text-white">
                  <h3 className="font-heading font-bold text-base sm:text-xl md:text-2xl leading-tight">{c.name}</h3>
                  <p className="text-xs sm:text-sm text-white/80 mt-1">{c.desc}</p>
                  <ArrowRight className="w-5 h-5 mt-2 sm:mt-3 text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>);

          })}
        </div>
      </section>

      {/* Recommendations */}
      <Recommendations />

      {/* About */}
      



























      

      <Newsletter />
      <Footer />
    </div>);

}