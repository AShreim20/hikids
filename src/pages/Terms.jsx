import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';

const CONTENT = {
  ar: {
    title: 'الشروط والأحكام',
    updated: 'آخر تحديث: 27 أغسطس 2026',
    intro:
      'مرحبًا بك في متجر HiKids. باستخدامك لموقعنا أو إنشاء حساب أو إجراء أي طلب، فإنك توافق على الالتزام بالشروط والأحكام التالية. يُرجى قراءتها بعناية قبل استخدام الموقع.',
    sections: [
      {
        h: '1. استخدام الموقع',
        intro:
          'يمنحك هذا الموقع إمكانية تصفّح المنتجات وإنشاء حساب وإجراء الطلبات. باستخدامك للموقع فإنك تتعهد باستخدامه لأغراض مشروعة فقط، وعدم إساءة استخدامه أو محاولة الإضرار به أو تعطيله.',
        items: [],
      },
      {
        h: '2. الحسابات',
        intro:
          'يجب أن تكون بسن يسمح لك قانونًا بإجراء المشتريات لإنشاء حساب. أنت مسؤول عن صحة المعلومات المُدخلة عند التسجيل، وعن الحفاظ على سرية بيانات تسجيل الدخول، وعن كل النشاط الذي يجري عبر حسابك.',
        items: [],
      },
      {
        h: '3. المنتجات ومعلوماتها',
        intro:
          'نحرص على عرض المنتجات وأوصافها وأعمارها الاستهدائية بأكبر قدر من الدقة. ومع ذلك قد تختلف الألوان أو بعض التفاصيل عن الواقع بسبب إعدادات الشاشة. في حال وجود أي استفسار حول منتج، يُرجى التواصل معنا قبل إتمام الطلب.',
        items: [],
      },
      {
        h: '4. الأسعار والعروض',
        intro:
          'تُعرض جميع الأسعار بعملة الموقع وتشمل الضرائب المطبّقة حيثما اقتضى الأمر. نحتفظ بالحق في تعديل الأسعار والعروض في أي وقت دون إشعار مسبق، وتكون الأسعار السارية هي المعتمدة وقت تأكيد الطلب.',
        items: [
          'الخصومات والعروض تخضع للشروط الموضحة مع كل عرض وقد تكون محدودة المدة أو الكمية.',
          'لا يمكن الجمع بين خصمتين على نفس المنتج إلا إذا ذُكر خلاف ذلك صراحةً.',
        ],
      },
      {
        h: '5. الطلبات وتأكيدها',
        intro:
          'عند إرسال طلبك، يُرسل إليك تأكيد عبر البريد الإلكتروني أو رسالة نصية. لا يُعتبر الطلب ملزمًا لنا إلا بعد تأكيده من قِبلنا، ويحق لنا رفض أي طلب أو إلغائه لأسباب تتعلق بسلامة الطلب أو توفّر المنتج أو صحة المعلومات.',
        items: [],
      },
      {
        h: '6. الدفع',
        intro:
          'يدعم الموقع حاليًا الدفع عند الاستلام واستخدام نقاط الولاء. في حال إضافة وسائل دفع إلكترونية مستقبلًا، ستخضع لشروط الدفع المعلنة وقتها.',
        items: [],
      },
      {
        h: '7. الشحن والتوصيل',
        intro:
          'نعمل على توصيل الطلبات إلى العناوين داخل المدن المحددة عبر الموقع. تختلف أوقات التوصيل حسب المدينة وظروف التوصيل، ونبذل جهدنا لتسليم الطلب خلال المدة المتوقعة دون تحمّل المسؤولية عن التأخير الناتج عن أسباب خارج سيطرتنا.',
        items: [],
      },
      {
        h: '8. الإرجاع والاستبدال',
        intro:
          'يمكنك طلب الإرجاع أو الاستبدال وفق سياسة الإرجاع المعمول بها على الموقع، وبالشروط المتعلقة بحالة المنتج ومدة الإرجاع المسموح بها. يُرجى مراجعة سياسة الإرجاع أو التواصل معنا للتفاصيل.',
        items: [],
      },
      {
        h: '9. المنتجات التالفة أو غير المطابقة',
        intro:
          'إذا وصلك منتج تالف أو غير مطابق لطلبك، يُرجى التواصل معنا خلال المدة المحددة في سياسة الإرجاع مع إرفاق صور للحالة، وسنعمل على حل المشكلة عبر استبدال المنتج أو إرجاع المبلغ وفق الإجراءات المعمول بها.',
        items: [],
      },
      {
        h: '10. نقاط الولاء',
        intro:
          'نقاط الولاء هي مكافأة تُمنح للعملاء وفق قواعد برنامج الولاء المعمول به. لا تُعتبر نقاط الولاء عملة أو حقًا ماليًا قابلًا للتحويل، ويحق لنا تعديل قواعد البرنامج أو إلغائه أو تعديل رصيد النقاط وفق شروط البرنامج.',
        items: [
          'قد تنتهي صلاحية بعض النقاط وفق إعدادات البرنامج.',
          'تخضع بعض المنتجات أو العروض لاستثناءات من كسب أو استخدام النقاط.',
        ],
      },
      {
        h: '11. الكوبونات والمكافآت',
        intro:
          'تخضع الكوبونات والمكافآت لشروط الاستخدام الموضحة مع كل كوبون، وقد تكون محدودة الاستخدام أو مرتبطة بحد أدنى للطلب. لا يمكن استبدال الكوبونات بقيمتها النقدية.',
        items: [],
      },
      {
        h: '12. مساعد التسوق الذكي',
        intro:
          'يوفّر الموقع مساعد تسوق ذكي لمساعدتك في اختيار المنتجات والإجابة عن استفساراتك. تُقدَّم توصياته ومعلوماته لأغراض المساعدة فقط، ولا تُلزمنا بأي ضمان، ويبقى القرار النهائي للطلبات لك.',
        items: [],
      },
      {
        h: '13. سلامة الأطفال',
        intro:
          'نحرص على عرض الأعمار الاستهدائية لكل منتج، ويُعدّ الإشراف أثناء اللعب مسؤولية ولي الأمر. يُرجى الالتزام بإرشادات الأعمار والتحذيرات الموضحة على المنتجات لضمان سلامة الأطفال.',
        items: [],
      },
      {
        h: '14. الملكية الفكرية',
        intro:
          'جميع المحتويات على الموقع—بما في ذلك الأسماء والشعارات والتصاميم والنصوص والصور—مملوكة لنا أو مرخّصة لنا، ولا يجوز نسخها أو استخدامها أو إعادة نشرها دون إذن مكتوب.',
        items: [],
      },
      {
        h: '15. تقييمات ومحتوى المستخدمين',
        intro:
          'عند إضافة تقييم أو تعليق أو صورة، تتعهد بأن المحتوى دقيق ولا ينتهك حقوق الآخرين ولا يحتوي على مواد غير لائقة. يحق لنا مراجعة المحتوى أو رفضه أو إزالته، ولا نتحمّل مسؤولية آراء المستخدمين المُعبَّر عنها في التقييمات.',
        items: [],
      },
      {
        h: '16. الخصوصية وحماية البيانات',
        intro:
          'تخضع معالجة بياناتك الشخصية لسياسة الخصوصية المنشورة على الموقع. يُرجى مراجعة سياسة الخصوصية لمعرفة كيفية جمع معلوماتك واستخدامها وحمايتها.',
        items: [],
      },
      {
        h: '17. الروابط والخدمات الخارجية',
        intro:
          'قد يحتوي الموقع على روابط لمواقع أو خدمات خارجية لا نتحكم فيها، ولا نتحمّل مسؤولية محتواها أو ممارساتها. استخدامك لها يخضع لشروط تلك الأطراف.',
        items: [],
      },
      {
        h: '18. حدود المسؤولية',
        intro:
          'نقدّم الموقع والمنتجات "كما هو" ضمن الحدود المسموح بها قانونًا. لا نتحمّل أي مسؤولية عن الأضرار غير المباشرة أو العرضية الناتجة عن استخدام الموقع أو المنتجات بما يتجاوز الحدود القانونية المسموح بها.',
        items: [],
      },
      {
        h: '19. الظروف الخارجة عن السيطرة',
        intro:
          'لا نتحمّل المسؤولية عن أي إخلال بالالتزامات الناتج عن ظروف خارجة عن سيطرتنا، مثل الكوارث الطبيعية أو الإجراءات الحكومية أو تعطل شبكات التوصيل أو الاتصالات أو غيرها من الحالات الطارئة.',
        items: [],
      },
      {
        h: '20. تعليق الحساب أو الخدمة',
        intro:
          'يحق لنا تعليق أو إيقاف حسابك أو الخدمة في حال مخالفة هذه الشروط أو وجود نشاط يضر بالموقع أو بالعملاء، دون إشعار مسبق ودون المساس بحقوقنا الأخرى.',
        items: [],
      },
      {
        h: '21. تعديل الشروط',
        intro:
          'قد نقوم بتعديل هذه الشروط من وقت لآخر، وتُنشر التحديثات على هذه الصفحة مع تاريخ آخر تحديث. استمرارك في استخدام الموقع بعد التحديث يُعدّ موافقة على الشروط المعدّلة.',
        items: [],
      },
      {
        h: '22. القانون المعمول به وتسوية النزاعات',
        intro:
          'تخضع هذه الشروط للقوانين المعمول بها في مكان تقديم الخدمة، وتُسوى أي نزاعات ناتجة عنها بالطرق الودية أولًا، وللمحاكم المختصة النظر في ما لا يمكن حله وديًا.',
        items: [],
      },
      {
        h: '23. التواصل معنا',
        intro:
          'لأي استفسار حول هذه الشروط، يمكنك التواصل معنا عبر قنوات التواصل المتاحة على الموقع.',
        items: [],
      },
      {
        h: '24. إقرار المستخدم',
        intro:
          'باستخدامك للموقع، تُقرّ بأنك قرأت هذه الشروط ووافقت عليها، وأنك ملتزم بها بالكامل.',
        items: [],
      },
    ],
    privacyLink: 'للاطّلاع على كيفية استخدامنا لمعلوماتك، يُرجى مراجعة',
    privacyLinkLabel: 'سياسة الخصوصية',
    privacyLinkSuffix: '.',
  },
  en: {
    title: 'Terms & Conditions',
    updated: 'Last Updated: August 27, 2026',
    intro:
      'Welcome to HiKids. By using our website, creating an account, or placing any order, you agree to comply with the following terms and conditions. Please read them carefully before using the website.',
    sections: [
      {
        h: '1. Use of the Website',
        intro:
          'This website allows you to browse products, create an account, and place orders. By using the website you agree to use it for legitimate purposes only and not to misuse it or attempt to harm, disable, or disrupt it.',
        items: [],
      },
      {
        h: '2. User Accounts',
        intro:
          'You must be of legal age to make purchases in order to create an account. You are responsible for the accuracy of the information provided at registration, for keeping your login credentials confidential, and for all activity that occurs through your account.',
        items: [],
      },
      {
        h: '3. Products & Product Information',
        intro:
          'We strive to present products, their descriptions, and recommended age ranges as accurately as possible. However, colors or certain details may differ in reality due to screen settings. If you have any question about a product, please contact us before completing your order.',
        items: [],
      },
      {
        h: '4. Prices & Promotions',
        intro:
          'All prices are displayed in the website currency and include applicable taxes where required. We reserve the right to change prices and promotions at any time without prior notice; the prices in effect at the time of order confirmation shall apply.',
        items: [
          'Discounts and promotions are subject to the conditions stated with each offer and may be limited in time or quantity.',
          'Two discounts may not be combined on the same product unless explicitly stated otherwise.',
        ],
      },
      {
        h: '5. Orders & Order Confirmation',
        intro:
          'When you submit your order, a confirmation is sent to you by email or text message. An order is not binding on us until confirmed by us, and we reserve the right to refuse or cancel any order for reasons related to order integrity, product availability, or information accuracy.',
        items: [],
      },
      {
        h: '6. Payment',
        intro:
          'The website currently supports Cash on Delivery and Loyalty Points. If electronic payment methods are introduced in the future, they will be subject to the payment terms announced at that time.',
        items: [],
      },
      {
        h: '7. Shipping & Delivery',
        intro:
          'We deliver orders to addresses within the cities specified on the website. Delivery times vary by city and delivery conditions, and we do our best to deliver within the expected timeframe without liability for delays caused by circumstances beyond our control.',
        items: [],
      },
      {
        h: '8. Returns & Exchanges',
        intro:
          'You may request a return or exchange in accordance with the return policy in effect on the website and the conditions related to the product condition and the allowed return period. Please review the return policy or contact us for details.',
        items: [],
      },
      {
        h: '9. Damaged or Incorrect Products',
        intro:
          'If you receive a damaged or incorrect product, please contact us within the period specified in the return policy and attach photos of the condition. We will work to resolve the issue through a replacement or refund according to the applicable procedures.',
        items: [],
      },
      {
        h: '10. Loyalty Points',
        intro:
          'Loyalty points are a reward granted to customers according to the loyalty program rules in effect. Loyalty points are not a currency or a transferable financial right, and we may modify the program rules, cancel the program, or adjust point balances according to the program terms.',
        items: [
          'Some points may expire according to the program settings.',
          'Certain products or offers may be excluded from earning or using points.',
        ],
      },
      {
        h: '11. Coupons & Rewards',
        intro:
          'Coupons and rewards are subject to the terms of use stated with each coupon, and may be limited in usage or tied to a minimum order amount. Coupons cannot be exchanged for their cash value.',
        items: [],
      },
      {
        h: '12. AI Shopping Assistant',
        intro:
          'The website provides an AI shopping assistant to help you choose products and answer your questions. Its recommendations and information are provided for assistance purposes only, do not bind us to any guarantee, and the final decision on orders remains yours.',
        items: [],
      },
      {
        h: '13. Child Safety',
        intro:
          'We are keen to display the recommended age range for each product, and supervision during play remains the responsibility of the guardian. Please follow the age guidelines and warnings shown on products to ensure children’s safety.',
        items: [],
      },
      {
        h: '14. Intellectual Property',
        intro:
          'All content on the website—including names, logos, designs, texts, and images—is owned by us or licensed to us, and may not be copied, used, or republished without written permission.',
        items: [],
      },
      {
        h: '15. Reviews & User Content',
        intro:
          'When you add a review, comment, or photo, you confirm that the content is accurate, does not infringe the rights of others, and does not contain inappropriate material. We may review, reject, or remove content, and we are not responsible for the opinions expressed by users in reviews.',
        items: [],
      },
      {
        h: '16. Privacy',
        intro:
          'The processing of your personal data is governed by the Privacy Policy published on the website. Please review the Privacy Policy to learn how your information is collected, used, and protected.',
        items: [],
      },
      {
        h: '17. Third-Party Services',
        intro:
          'The website may contain links to external websites or services that we do not control, and we are not responsible for their content or practices. Your use of them is subject to those parties\' terms.',
        items: [],
      },
      {
        h: '18. Limitation of Liability',
        intro:
          'We provide the website and products "as is" within the limits permitted by law. We are not liable for any indirect or incidental damages resulting from the use of the website or the products, to the extent permitted by law.',
        items: [],
      },
      {
        h: '19. Force Majeure',
        intro:
          'We are not liable for any failure to perform obligations arising from circumstances beyond our control, such as natural disasters, governmental measures, disruption of delivery or communication networks, or other emergencies.',
        items: [],
      },
      {
        h: '20. Suspension & Termination',
        intro:
          'We may suspend or terminate your account or the service in the event of a breach of these terms or any activity that harms the website or customers, without prior notice and without prejudice to our other rights.',
        items: [],
      },
      {
        h: '21. Changes to These Terms',
        intro:
          'We may update these terms from time to time, and updates will be published on this page along with the updated date. Your continued use of the website after an update constitutes acceptance of the amended terms.',
        items: [],
      },
      {
        h: '22. Governing Law & Disputes',
        intro:
          'These terms are governed by the laws applicable in the place where the service is provided. Any disputes arising from them shall first be settled amicably, and matters that cannot be resolved amicably shall be referred to the competent courts.',
        items: [],
      },
      {
        h: '23. Contact Us',
        intro:
          'For any inquiry regarding these terms, you can contact us through the communication channels available on the website.',
        items: [],
      },
      {
        h: '24. User Acknowledgment',
        intro:
          'By using the website, you acknowledge that you have read and agreed to these terms and that you are fully bound by them.',
        items: [],
      },
    ],
    privacyLink: 'To learn how we use your information, please review our',
    privacyLinkLabel: 'Privacy Policy',
    privacyLinkSuffix: '.',
  },
};

export default function Terms() {
  const { lang } = useLanguage();
  const c = lang === 'ar' ? CONTENT.ar : CONTENT.en;
  const ar = lang === 'ar';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="max-w-3xl mx-auto px-5 sm:px-8 pt-12 md:pt-20 pb-24">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-cosmic/10">
          <FileText className="w-7 h-7 text-cosmic" />
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
          {c.privacyLink}{' '}
          <Link to="/privacy" className="text-cosmic font-medium hover:underline">
            {c.privacyLinkLabel}
          </Link>
          {c.privacyLinkSuffix}
        </p>
      </section>

      <Footer />
    </div>
  );
}