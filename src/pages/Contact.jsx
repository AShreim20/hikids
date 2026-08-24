import React from 'react';
import { Mail, Phone, Instagram, Facebook, MapPin, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';

export default function Contact() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const methods = [
    { icon: Mail, label: ar ? 'البريد الإلكتروني' : 'Email', value: 'hello@hikids.ps', href: 'mailto:hello@hikids.ps' },
    { icon: Phone, label: ar ? 'واتساب' : 'WhatsApp', value: '+970 59 000 0000', href: 'https://wa.me/970590000000' },
    { icon: Instagram, label: 'Instagram', value: '@hi_kids.ps', href: 'https://www.instagram.com/hi_kids.ps/?hl=en' },
    { icon: Facebook, label: 'Facebook', value: 'HiKids', href: 'https://www.facebook.com/share/gBAGEMdhAwMobxRD/?mibextid=qi2Omg' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-12 md:py-20">
        <h1 className="font-heading font-extrabold text-4xl md:text-6xl tracking-tight text-balance">
          {ar ? 'تواصل معنا' : 'Contact us'}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl">
          {ar
            ? 'فريق HiKids جاهز لمساعدتك في اختيار الهدية المناسبة، أو متابعة طلبك، أو الإجابة عن أي سؤال حول الألعاب والتوصيل والدفع. اختر الطريقة الأنسب لك وسنعود إليك بأسرع وقت.'
            : 'The HiKids team is here to help you pick the right gift, follow up on an order, or answer any question about our toys, delivery, and payment options. Choose whichever channel suits you and we will get back to you shortly.'}
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {methods.map((m) => (
            <a
              key={m.label}
              href={m.href}
              className="flex items-center gap-4 rounded-3xl bg-card border border-border/60 p-5 hover:border-cosmic/40 transition-colors"
            >
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10 shrink-0">
                <m.icon className="w-6 h-6 text-cosmic" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-muted-foreground">{m.label}</span>
                <span className="block font-heading font-bold truncate">{m.value}</span>
              </span>
            </a>
          ))}
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          <div className="rounded-3xl bg-mist/60 p-6">
            <MapPin className="w-6 h-6 text-cosmic" />
            <h2 className="mt-3 font-heading font-bold text-xl">{ar ? 'موقعنا' : 'Where we are'}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {ar ? 'فلسطين — نوصّل إلى معظم المدن.' : 'Palestine — we deliver to most cities.'}
            </p>
          </div>
          <div className="rounded-3xl bg-mist/60 p-6">
            <Clock className="w-6 h-6 text-cosmic" />
            <h2 className="mt-3 font-heading font-bold text-xl">{ar ? 'ساعات الرد' : 'Response hours'}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {ar ? 'السبت – الخميس، 9 صباحًا – 7 مساءً.' : 'Saturday – Thursday, 9 AM – 7 PM.'}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}