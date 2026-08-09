import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowRight } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';

export default function FAQ() {
  const { lang, t } = useLanguage();

  const faqs = lang === 'ar' ? [
    { q: 'كم تستغرق مدة التوصيل؟', a: 'يصل طلبك عادةً خلال 2-5 أيام عمل داخل فلسطين وأجزاء من إسرائيل. ستصلك رسالة تأكيد وتحديث عند الشحن.' },
    { q: 'ما هي تكلفة التوصيل؟', a: 'التوصيل مجاني لجميع الطلبات داخل مناطق الخدمة.' },
    { q: 'ما طرق الدفع المتاحة؟', a: 'يمكنك الدفع بالبطاقة (فيزا، ماستركارد، وغيرها) أونلاين بأمان، أو نقدًا عند استلام الطلب عند باب منزلك.' },
    { q: 'هل يمكنني إرجاع منتج؟', a: 'نعم، يمكنك إرجاع المنتجات خلال 14 يومًا من الاستلام بحالتها الأصلية. تواصل معنا لبدء عملية الإرجاع.' },
    { q: 'كيف أتتبّع طلبي؟', a: 'استخدم صفحة "تتبّع الطلب" وأدخل رقم طلبك لمعرفة حالته الحالية.' },
    { q: 'هل الألعاب آمنة على الأطفال؟', a: 'بالتأكيد. كل لعبة مختارة بعناية وتلتزم بأعلى معايير السلامة، بخامات طبيعية وآمنة.' },
    { q: 'هل أحتاج إلى حساب للشراء؟', a: 'يمكنك الشراء كضيف، لكن إنشاء حساب يمنحك تتبّعًا أسهل لطلباتك وحفظ معلوماتك للمرات القادمة.' },
  ] : [
    { q: 'How long does delivery take?', a: 'Your order usually arrives within 2-5 business days across Palestine and parts of Israel. You will receive a confirmation and a shipping update.' },
    { q: 'How much is delivery?', a: 'Delivery is free for all orders within our service areas.' },
    { q: 'What payment methods are available?', a: 'You can pay by card (Visa, Mastercard, and more) securely online, or pay with cash when your order arrives at your door.' },
    { q: 'Can I return a product?', a: 'Yes — you can return products within 14 days of delivery in their original condition. Contact us to start a return.' },
    { q: 'How do I track my order?', a: 'Use the "Track Order" page and enter your order number to see its current status.' },
    { q: 'Are the toys safe for children?', a: 'Absolutely. Every toy is carefully selected and meets the highest safety standards, using natural, safe materials.' },
    { q: 'Do I need an account to shop?', a: 'You can check out as a guest, but creating an account makes tracking easier and saves your details for next time.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 md:pt-20 pb-10 text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mist text-foreground/70 text-xs font-medium tracking-wider uppercase">
          <HelpCircle className="w-3.5 h-3.5 text-accent" /> {t('faq.subtitle')}
        </span>
        <h1 className="mt-6 font-heading font-extrabold text-5xl md:text-7xl leading-[1.05] tracking-tight text-balance">
          {t('faq.title')}
        </h1>
      </section>

      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-10 md:py-16">
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-3xl bg-card border border-border/60 px-5 md:px-6"
            >
              <AccordionTrigger className="font-heading font-bold text-lg md:text-xl text-left">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed text-base">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-12 rounded-3xl bg-mist/60 p-8 text-center">
          <p className="font-heading font-bold text-xl">
            {lang === 'ar' ? 'لديك سؤال آخر؟' : 'Still have a question?'}
          </p>
          <p className="mt-2 text-muted-foreground">
            {lang === 'ar'
              ? 'تصفّح مجموعتنا أو تتبّع طلبك.'
              : 'Browse our collection or track your order.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/track-order"
              className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold"
            >
              {t('nav.track')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/"
              className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-card border border-border font-heading font-bold"
            >
              {t('nav.explore')}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}