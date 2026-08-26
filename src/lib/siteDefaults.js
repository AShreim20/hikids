// Default static content, used as the fallback when no DB record exists yet.
// These mirror the originally hard-coded website copy so nothing disappears
// before the admin saves anything — and they seed the admin editor.

export const DEFAULT_SETTINGS = {
  storeName: 'HiKids',
  logoUrl: '',
  phone: '+970 59 900 0000',
  phoneTel: '+970599000000',
  whatsapp: '970599000000',
  email: 'hello@hikids.ps',
  instagram: 'https://www.instagram.com/hi_kids.ps/?hl=en',
  facebook: 'https://www.facebook.com/share/gBAGEMdhAwMobxRD/?mibextid=qi2Omg',
  addressAr: 'فلسطين — نوصّل إلى معظم المدن.',
  addressEn: 'Palestine — we deliver to most cities.',
  hoursAr: 'السبت – الخميس، 9 صباحًا – 7 مساءً.',
  hoursEn: 'Saturday – Thursday, 9 AM – 7 PM.',
};

export const DEFAULT_FAQ_ITEMS = [
  {
    q_ar: 'كم تستغرق مدة التوصيل؟',
    q_en: 'How long does delivery take?',
    a_ar: 'يصل طلبك عادةً خلال 2-5 أيام عمل داخل فلسطين وأجزاء من إسرائيل. ستصلك رسالة تأكيد وتحديث عند الشحن.',
    a_en: 'Your order usually arrives within 2-5 business days across Palestine and parts of Israel. You will receive a confirmation and a shipping update.',
  },
  {
    q_ar: 'ما هي تكلفة التوصيل؟',
    q_en: 'How much is delivery?',
    a_ar: 'التوصيل مجاني لجميع الطلبات داخل مناطق الخدمة.',
    a_en: 'Delivery is free for all orders within our service areas.',
  },
  {
    q_ar: 'ما طرق الدفع المتاحة؟',
    q_en: 'What payment methods are available?',
    a_ar: 'يمكنك الدفع بالبطاقة (فيزا، ماستركارد، وغيرها) أونلاين بأمان، أو نقدًا عند استلام الطلب عند باب منزلك.',
    a_en: 'You can pay by card (Visa, Mastercard, and more) securely online, or pay with cash when your order arrives at your door.',
  },
  {
    q_ar: 'هل يمكنني إرجاع منتج؟',
    q_en: 'Can I return a product?',
    a_ar: 'نعم، يمكنك إرجاع المنتجات خلال 14 يومًا من الاستلام بحالتها الأصلية. تواصل معنا لبدء عملية الإرجاع.',
    a_en: 'Yes — you can return products within 14 days of delivery in their original condition. Contact us to start a return.',
  },
  {
    q_ar: 'كيف تعمل نقاط الولاء؟',
    q_en: 'How do loyalty points work?',
    a_ar: 'تكسب نقطة واحدة مقابل كل ₪1 تنفقها على الألعاب. تظهر النقاط في رصيدك بعد كل طلب مكتمل، ويمكنك استبدالها عند الدفع — 10 نقاط = ₪1 خصم على طلبك.',
    a_en: 'You earn 1 point for every ₪1 you spend on toys. Points appear in your balance after each completed order, and you can redeem them at checkout — 10 points = ₪1 off your order.',
  },
  {
    q_ar: 'كيف أستبدل نقاط ولائي؟',
    q_en: 'How do I redeem my loyalty points?',
    a_ar: 'عند الدفع، اختر "استبدل النقاط" وأدخل عدد النقاط التي تريد استخدامها. 10 نقاط تساوي ₪1 خصم، ويُطبّق الخصم على إجماليك فورًا.',
    a_en: 'At checkout, choose "Redeem points" and enter how many points you want to use. 10 points equal ₪1 off, and the discount is applied to your total instantly.',
  },
  {
    q_ar: 'هل تنتهي صلاحية نقاط ولائي؟',
    q_en: 'Do my loyalty points expire?',
    a_ar: 'لا — تبقى نقاطك في حسابك حتى تختار استبدالها. سجّل الدخول وزر صفحة "نقاطي" لعرض رصيدك.',
    a_en: 'No — your points stay in your account until you choose to redeem them. Sign in and visit the "My points" page to view your balance.',
  },
  {
    q_ar: 'كيف أتتبّع طلبي؟',
    q_en: 'How do I track my order?',
    a_ar: 'استخدم صفحة "تتبّع الطلب" وأدخل رقم طلبك لمعرفة حالته الحالية.',
    a_en: 'Use the "Track Order" page and enter your order number to see its current status.',
  },
  {
    q_ar: 'هل الألعاب آمنة على الأطفال؟',
    q_en: 'Are the toys safe for children?',
    a_ar: 'بالتأكيد. كل لعبة مختارة بعناية وتلتزم بأعلى معايير السلامة، بخامات طبيعية وآمنة.',
    a_en: 'Absolutely. Every toy is carefully selected and meets the highest safety standards, using natural, safe materials.',
  },
  {
    q_ar: 'هل أحتاج إلى حساب للشراء؟',
    q_en: 'Do I need an account to shop?',
    a_ar: 'يمكنك الشراء كضيف، لكن إنشاء حساب يمنحك تتبّعًا أسهل لطلباتك وحفظ معلوماتك للمرات القادمة.',
    a_en: 'You can check out as a guest, but creating an account makes tracking easier and saves your details for next time.',
  },
];

export const DEFAULT_ABOUT = {
  storyAr: [
    'بدأت HiKids بحلم بسيط: أن تكون اللعبة أكثر من مجرد تسلية — أن تكون تجربة تُثري الطفل وتُصان وتُورَّث.',
    'نختار كل قطعة بعناية، ونتعاون مع صُنّاع محليين ينتجون دفعات صغيرة من خامات مستدامة وآمنة على الأطفال.',
    'نؤمن أن اللعب الراقي لا يحتاج إلى ضجيج، بل إلى جودة وصبر وقلب. لذلك نغلّف كل طلبٍ كهدية، ونمنحك خيار الدفع بالبطاقة أو نقدًا عند التوصيل.',
  ],
  storyEn: [
    'HiKids began with a simple dream: that a toy should be more than entertainment — it should be an experience that enriches a child, is cared for, and passed on.',
    'We choose every piece with care, partnering with local makers who craft in small batches from sustainable, child-safe materials.',
    'We believe premium play needs no noise — only quality, patience, and heart. So we wrap every order like a gift, and let you pay by card or cash on delivery.',
  ],
  storyLabelAr: 'قصتنا',
  storyLabelEn: 'Our story',
  storyTitleAr: 'من الشغف إلى المتجر',
  storyTitleEn: 'From passion to a store',
  valuesLabelAr: 'قيمنا',
  valuesLabelEn: 'Our values',
  valuesTitleAr: 'ما الذي يحرّكنا',
  valuesTitleEn: 'What moves us',
  valuesAr: [
    { title: 'استدامة', desc: 'خامات طبيعية وآمنة، مصنوعة باحترام للبيئة.' },
    { title: 'أمان', desc: 'كل لعبة تُختبَر لتلبي أعلى معايير السلامة.' },
    { title: 'صناعة بقلب', desc: 'نتعاون مع حرفيين ينتجون دفعات صغيرة بعناية.' },
    { title: 'جودة تدوم', desc: 'ألعاب مصمّمة لتُورَّث، لا لتُرمى.' },
  ],
  valuesEn: [
    { title: 'Sustainability', desc: 'Natural, safe materials, made with respect for the planet.' },
    { title: 'Safety', desc: 'Every toy is tested to meet the highest safety standards.' },
    { title: 'Made with heart', desc: 'We work with artisans who craft in small, careful batches.' },
    { title: 'Lasting quality', desc: 'Toys designed to be passed down, not thrown away.' },
  ],
  ctaTitleAr: 'اكتشف المجموعة',
  ctaTitleEn: 'Discover the collection',
  ctaDescAr: 'ألعاب مختارة بعناية، بانتظار أن تُكتشف.',
  ctaDescEn: 'Curated toys, waiting to be discovered.',
  ctaBtnAr: 'تصفّح الآن',
  ctaBtnEn: 'Browse now',
};