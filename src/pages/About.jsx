import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Heart, ShieldCheck, Leaf, Truck, Star, ArrowRight } from 'lucide-react';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';

export default function About() {
  const { lang, t } = useLanguage();

  const story = lang === 'ar' ? [
    'بدأت HiKids بحلم بسيط: أن تكون اللعبة أكثر من مجرد تسلية — أن تكون تجربة تُثري الطفل وتُصان وتُورَّث.',
    'نختار كل قطعة بعناية، ونتعاون مع صُنّاع محليين ينتجون دفعات صغيرة من خامات مستدامة وآمنة على الأطفال.',
    'نؤمن أن اللعب الراقي لا يحتاج إلى ضجيج، بل إلى جودة وصبر وقلب. لذلك نغلّف كل طلبٍ كهدية، ونمنحك خيار الدفع بالبطاقة أو نقدًا عند التوصيل.',
  ] : [
    'HiKids began with a simple dream: that a toy should be more than entertainment — it should be an experience that enriches a child, is cared for, and passed on.',
    'We choose every piece with care, partnering with local makers who craft in small batches from sustainable, child-safe materials.',
    'We believe premium play needs no noise — only quality, patience, and heart. So we wrap every order like a gift, and let you pay by card or cash on delivery.',
  ];

  const values = lang === 'ar' ? [
    { icon: Leaf, title: 'استدامة', desc: 'خامات طبيعية وآمنة، مصنوعة باحترام للبيئة.' },
    { icon: ShieldCheck, title: 'أمان', desc: 'كل لعبة تُختبَر لتلبي أعلى معايير السلامة.' },
    { icon: Heart, title: 'صناعة بقلب', desc: 'نتعاون مع حرفيين ينتجون دفعات صغيرة بعناية.' },
    { icon: Star, title: 'جودة تدوم', desc: 'ألعاب مصمّمة لتُورَّث، لا لتُرمى.' },
  ] : [
    { icon: Leaf, title: 'Sustainability', desc: 'Natural, safe materials, made with respect for the planet.' },
    { icon: ShieldCheck, title: 'Safety', desc: 'Every toy is tested to meet the highest safety standards.' },
    { icon: Heart, title: 'Made with heart', desc: 'We work with artisans who craft in small, careful batches.' },
    { icon: Star, title: 'Lasting quality', desc: 'Toys designed to be passed down, not thrown away.' },
  ];

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
              src="https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/df023ab5e_generated_37f54450.png"
              alt="HiKids toys"
              fittingType="fill"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
              {lang === 'ar' ? 'قصتنا' : 'Our story'}
            </p>
            <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl leading-tight text-balance">
              {lang === 'ar' ? 'من الشغف إلى المتجر' : 'From passion to a store'}
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
            {lang === 'ar' ? 'قيمنا' : 'Our values'}
          </p>
          <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl text-center text-balance">
            {lang === 'ar' ? 'ما الذي يحرّكنا' : 'What moves us'}
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
            {lang === 'ar' ? 'اكتشف المجموعة' : 'Discover the collection'}
          </h2>
          <p className="mt-4 text-white/70 max-w-xl mx-auto text-lg">
            {lang === 'ar'
              ? 'ألعاب مختارة بعناية، بانتظار أن تُكتشف.'
              : 'Curated toys, waiting to be discovered.'}
          </p>
          <Link
            to="/"
            className="mt-8 squish inline-flex items-center gap-2 h-14 px-8 rounded-full bg-white text-cosmic font-heading font-bold"
          >
            {lang === 'ar' ? 'تصفّح الآن' : 'Browse now'} <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}