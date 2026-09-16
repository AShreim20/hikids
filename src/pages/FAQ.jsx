import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import InquiryForm from '@/components/faq/InquiryForm';
import { useLanguage } from '@/context/LanguageContext';
import { useSiteContent } from '@/context/SiteContentContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { SITE_URL } from '@/lib/siteUrl';

export default function FAQ() {
  const { lang, t } = useLanguage();
  const { faqItems } = useSiteContent();
  useDocumentMeta({ title: `${t('faq.title')} | HiKids`, description: t('faq.subtitle'), canonical: `${SITE_URL}/faq` });

  const faqs = (faqItems || []).map((f) => ({
    q: lang === 'ar' ? (f.q_ar || f.q_en || '') : (f.q_en || f.q_ar || ''),
    a: lang === 'ar' ? (f.a_ar || f.a_en || '') : (f.a_en || f.a_ar || ''),
  }));

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

        <div className="mt-12 rounded-3xl bg-mist/60 p-6 sm:p-8 text-center">
          <p className="font-heading font-bold text-xl">
            {lang === 'ar' ? 'لديك سؤال آخر؟' : 'Have another question?'}
          </p>
          <p className="mt-2 text-muted-foreground">
            {lang === 'ar'
              ? 'ما لقيت جوابك؟ ابعتلنا سؤالك وسنساعدك.'
              : "Couldn't find your answer? Send us your question and we'll help."}
          </p>
          <InquiryForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}