import React from 'react';
import { ShieldCheck, Leaf, Truck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Recommendations from '@/components/Recommendations';
import HeroCarousel from '@/components/HeroCarousel';
import Newsletter from '@/components/Newsletter';
import WorldOfPlay from '@/components/home/WorldOfPlay';
import { useLanguage } from '@/context/LanguageContext';

export default function Home() {
  const { t } = useLanguage();

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

      {/* Categories */}
      <WorldOfPlay />

      {/* Recommendations */}
      <Recommendations />

      {/* About */}
      



























      

      <Newsletter />
      <Footer />
    </div>);

}