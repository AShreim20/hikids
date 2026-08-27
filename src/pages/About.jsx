import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Heart, ShieldCheck, Leaf, Truck, Star, ArrowRight } from 'lucide-react';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useSiteContent } from '@/context/SiteContentContext';

const VALUE_ICONS = [Leaf, ShieldCheck, Heart, Star];

export default function About() {
  const { lang, t } = useLanguage();
  const { about } = useSiteContent();
  const ar = lang === 'ar';

  const story = ar ? (about.storyAr || []) : (about.storyEn || []);
  const valuesRaw = ar ? (about.valuesAr || []) : (about.valuesEn || []);
  const values = valuesRaw.map((v, i) => ({
    icon: VALUE_ICONS[i] || Star,
    title: v.title || '',
    desc: v.desc || '',
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 md:pt-20 pb-16 md:pb-24 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mist text-foreground/70 text-xs font-medium tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-accent" /> {t('aboutPage.heroSub')}
          </span>
          <h1 className="mt-6 font-heading font-extrabold text-5xl md:text-7xl leading-[1.05] tracking-tight text-balance">
            {t('aboutPage.hero')}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {story[0]}
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div className="relative aspect-[4/3] rounded-[2.5rem] overflow-hidden bg-mist">
            <Image
              src="https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/8f9e38f8f_IMG-20240429-WA0012jpg.jpeg"
              alt="HiKids"
              fittingType="fill"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
              {ar ? about.storyLabelAr : about.storyLabelEn}
            </p>
            <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl leading-tight text-balance">
              {ar ? about.storyTitleAr : about.storyTitleEn}
            </h2>
            <div className="mt-6 space-y-4 text-lg text-muted-foreground leading-relaxed">
              {story.slice(1).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <p className="font-heading font-extrabold text-3xl text-cosmic">200+</p>
                <p className="text-sm text-muted-foreground">{t('about.curated')}</p>
              </div>
              <div>
                <p className="font-heading font-extrabold text-3xl text-cosmic">100%</p>
                <p className="text-sm text-muted-foreground">{t('about.safe')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-mist/50 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 md:py-24">
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium text-center">
            {ar ? about.valuesLabelAr : about.valuesLabelEn}
          </p>
          <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl text-center text-balance">
            {ar ? about.valuesTitleAr : about.valuesTitleEn}
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <div key={v.title} className="rounded-3xl bg-card border border-border/60 p-6">
                <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10">
                  <v.icon className="w-6 h-6 text-cosmic" />
                </div>
                <h3 className="mt-4 font-heading font-bold text-xl">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promise strip */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 md:py-24">
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            { icon: Leaf, title: t('promise.sustain'), desc: t('promise.sustainDesc') },
            { icon: ShieldCheck, title: t('promise.pay'), desc: t('promise.payDesc') },
            { icon: Truck, title: t('promise.delivery'), desc: t('promise.deliveryDesc') },
          ].map((p) => (
            <div key={p.title} className="flex items-center gap-4">
              <div className="grid place-items-center w-12 h-12 rounded-2xl bg-card shadow-sm">
                <p.icon className="w-6 h-6 text-cosmic" />
              </div>
              <div>
                <p className="font-heading font-bold">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-24">
        <div className="rounded-[2.5rem] bg-cosmic text-white px-6 sm:px-12 py-14 md:py-20 text-center">
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-balance">
            {ar ? about.ctaTitleAr : about.ctaTitleEn}
          </h2>
          <p className="mt-4 text-white/70 max-w-xl mx-auto text-lg">
            {ar ? about.ctaDescAr : about.ctaDescEn}
          </p>
          <Link
            to="/"
            className="mt-8 squish inline-flex items-center gap-2 h-14 px-8 rounded-full bg-white text-cosmic font-heading font-bold"
          >
            {ar ? about.ctaBtnAr : about.ctaBtnEn} <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}