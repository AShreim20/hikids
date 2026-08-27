import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';

const CONTENT = {
  ar: {
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: 27 أغسطس 2026',
    intro:
      'نحن نقدر خصوصيتك ونلتزم بحماية معلوماتك الشخصية واستخدامها فقط للأغراض اللازمة لتقديم خدماتنا وتحسين تجربتك على الموقع.',
    sections: [
      {
        h: '1. المعلومات التي نجمعها',
        intro: 'قد نجمع المعلومات التي تقدمها عند إنشاء حساب أو إجراء طلب، مثل:',
        items: [
          'الاسم ورقم الهاتف والبريد الإلكتروني.',
          'عنوان التوصيل.',
          'تفاصيل الطلبات والمشتريات.',
          'نقاط الولاء والمكافآت المرتبطة بحسابك.',
          'المعلومات التي تقدمها عند التواصل معنا.',
        ],
      },
      {
        h: '2. كيف نستخدم معلوماتك؟',
        intro: 'نستخدم معلوماتك من أجل:',
        items: [
          'إنشاء وإدارة حسابك.',
          'معالجة وتنفيذ طلباتك.',
          'توصيل الطلبات والتواصل معك بشأنها.',
          'إدارة نقاط الولاء والمكافآت.',
          'تقديم الدعم وتحسين خدمات الموقع.',
        ],
      },
      {
        h: '3. حماية معلوماتك',
        intro:
          'نتخذ إجراءات مناسبة لحماية معلوماتك من الوصول أو الاستخدام غير المصرح به. ولا نقوم ببيع أو تأجير معلوماتك الشخصية للغير.',
        items: [
          'قد تتم مشاركة المعلومات الضرورية مع مزودي الخدمات المرتبطين بتنفيذ طلبك، مثل شركات التوصيل، وبالقدر اللازم لتقديم الخدمة.',
        ],
      },
      {
        h: '4. معلومات الدفع',
        intro:
          'يوفر الموقع حاليًا الدفع عند الاستلام واستخدام نقاط الولاء، ولا نقوم بتخزين بيانات البطاقات البنكية.',
        items: [
          'في حال إضافة وسائل دفع إلكترونية مستقبلًا، سيتم تحديث هذه السياسة وفقًا لذلك.',
        ],
      },
      {
        h: '5. ملفات تعريف الارتباط',
        intro:
          'قد نستخدم ملفات تعريف الارتباط (Cookies) لتحسين أداء الموقع، حفظ بعض تفضيلاتك، وتحسين تجربة الاستخدام.',
        items: [],
      },
      {
        h: '6. حسابك',
        intro:
          'أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة بك. وفي حال نسيان كلمة المرور، يمكنك استخدام خيار "هل نسيت كلمة المرور؟" لإعادة تعيينها عبر البريد الإلكتروني المرتبط بحسابك.',
        items: [],
      },
      {
        h: '7. تحديث السياسة',
        intro:
          'قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سيتم نشر أي تحديثات على هذه الصفحة مع توضيح تاريخ آخر تحديث.',
        items: [],
      },
      {
        h: '8. تواصل معنا',
        intro:
          'إذا كان لديك أي سؤال حول خصوصيتك أو كيفية استخدام معلوماتك، يمكنك التواصل معنا عبر قنوات التواصل المتاحة على الموقع.',
        items: [],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last Updated: August 27, 2026',
    intro:
      'We value your privacy and are committed to protecting your personal information and using it only when necessary to provide our services and improve your experience on the website.',
    sections: [
      {
        h: '1. Information We Collect',
        intro: 'We may collect information you provide when creating an account or placing an order, including:',
        items: [
          'Name, phone number, and email address.',
          'Delivery address.',
          'Order and purchase details.',
          'Loyalty points and rewards associated with your account.',
          'Information you provide when contacting us.',
        ],
      },
      {
        h: '2. How We Use Your Information',
        intro: 'We use your information to:',
        items: [
          'Create and manage your account.',
          'Process and fulfill your orders.',
          'Deliver orders and communicate with you about them.',
          'Manage loyalty points and rewards.',
          'Provide customer support and improve our services.',
        ],
      },
      {
        h: '3. Protecting Your Information',
        intro:
          'We take appropriate measures to help protect your information from unauthorized access or use. We do not sell or rent your personal information to third parties.',
        items: [
          'We may share necessary information with service providers involved in fulfilling your order, such as delivery providers, only to the extent required to provide the service.',
        ],
      },
      {
        h: '4. Payment Information',
        intro:
          'The website currently supports Cash on Delivery and Loyalty Points. We do not store bank card information.',
        items: [
          'If electronic payment methods are introduced in the future, this policy will be updated accordingly.',
        ],
      },
      {
        h: '5. Cookies',
        intro:
          'We may use cookies to improve website performance, remember certain preferences, and enhance your browsing experience.',
        items: [],
      },
      {
        h: '6. Your Account',
        intro:
          'You are responsible for keeping your login credentials secure. If you forget your password, you can use the "Forgot Password?" option to reset it through the email address associated with your account.',
        items: [],
      },
      {
        h: '7. Policy Updates',
        intro:
          'We may update this Privacy Policy from time to time. Any changes will be published on this page along with the updated date.',
        items: [],
      },
      {
        h: '8. Contact Us',
        intro:
          'If you have any questions about your privacy or how we use your information, you can contact us through the communication channels available on the website.',
        items: [],
      },
    ],
  },
};

export default function PrivacyPolicy() {
  const { lang } = useLanguage();
  const c = lang === 'ar' ? CONTENT.ar : CONTENT.en;
  const ar = lang === 'ar';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="max-w-3xl mx-auto px-5 sm:px-8 pt-12 md:pt-20 pb-24">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-cosmic/10">
          <ShieldCheck className="w-7 h-7 text-cosmic" />
        </div>
        <h1 className="mt-5 font-heading font-extrabold text-4xl md:text-5xl text-balance" dir={ar ? 'rtl' : 'ltr'}>
          {c.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{c.updated}</p>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed" dir={ar ? 'rtl' : 'ltr'}>
          {c.intro}
        </p>

        <div className="mt-10 space-y-8">
          {c.sections.map((s, i) => (
            <div key={i}>
              <h2 className="font-heading font-bold text-xl md:text-2xl" dir={ar ? 'rtl' : 'ltr'}>
                {s.h}
              </h2>
              {s.intro && (
                <p className="mt-2 text-muted-foreground leading-relaxed" dir={ar ? 'rtl' : 'ltr'}>
                  {s.intro}
                </p>
              )}
              {s.items.length > 0 && (
                <ul className="mt-3 space-y-2 list-disc ps-6 text-muted-foreground leading-relaxed" dir={ar ? 'rtl' : 'ltr'}>
                  {s.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="mt-12 text-muted-foreground leading-relaxed" dir={ar ? 'rtl' : 'ltr'}>
          {ar ? 'للاطّلاع على شروط الاستخدام، يُرجى مراجعة' : 'For the terms of use, please review our'}{' '}
          <Link to="/terms" className="text-cosmic font-medium hover:underline">
            {ar ? 'الشروط والأحكام' : 'Terms & Conditions'}
          </Link>
          {ar ? '.' : '.'}
        </p>
      </section>

      <Footer />
    </div>
  );
}