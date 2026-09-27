// Metadata for the Site Content Admin "Page Text" tab: which translation
// keys are genuinely editable marketing/brand-voice copy (as opposed to
// software UI chrome — button mechanics, form validation, admin dashboard
// labels), what a non-technical admin should see instead of the raw key,
// and where that text appears on the site.
//
// Deliberately NOT exhaustive over translations.js (~964 keys total): most
// of the app's strings are functional UI text (checkout form labels, admin
// sidebar items, validation messages) that isn't "content" in the CMS sense
// and would be risky for a non-technical admin to edit casually (changing
// button/validation text can break a flow's clarity). Only keys that read
// like real marketing copy — headlines, descriptions, page intros — are
// listed here. This is intentional curation, not an omission; see the
// bilingual audit's final report for the reasoning.
//
// Each entry: { key, group, section?, type: 'input'|'textarea', label_ar,
// label_en, location_ar, location_en }. `section` groups keys into a small
// sub-heading inside a group's accordion panel (e.g. Homepage's Hero vs.
// Newsletter block) so a 50-field group doesn't render as one flat wall.

export const GROUPS = [
  { id: 'home', label_ar: 'الصفحة الرئيسية', label_en: 'Homepage' },
  { id: 'nav', label_ar: 'الهيدر والتنقل', label_en: 'Header & Navigation' },
  { id: 'footer', label_ar: 'الفوتر', label_en: 'Footer' },
  { id: 'loyalty', label_ar: 'الولاء والمكافآت', label_en: 'Loyalty & Rewards' },
  { id: 'about', label_ar: 'من نحن', label_en: 'About' },
  { id: 'faq', label_ar: 'الأسئلة الشائعة', label_en: 'FAQ' },
  { id: 'contact', label_ar: 'تواصل معنا', label_en: 'Contact' },
  { id: 'common', label_ar: 'رسائل عامة', label_en: 'General Messages' },
];

const home = (key, section, type, label_ar, label_en, location_ar, location_en) => ({
  key, group: 'home', section, type, label_ar, label_en,
  location_ar: `الصفحة الرئيسية ← ${location_ar}`, location_en: `Homepage → ${location_en}`,
});

export const TEXT_FIELD_META = [
  // Homepage — Hero
  home('hero.badge', 'Hero banner', 'input', 'شارة صغيرة فوق العنوان', 'Small badge above the headline', 'البانر الرئيسي', 'Hero banner'),
  home('hero.title', 'Hero banner', 'textarea', 'العنوان الرئيسي', 'Main headline', 'البانر الرئيسي', 'Hero banner'),
  home('hero.subtitle', 'Hero banner', 'textarea', 'الوصف تحت العنوان', 'Subheading under the headline', 'البانر الرئيسي', 'Hero banner'),
  home('hero.exploreCta', 'Hero banner', 'input', 'نص زر "تصفّح المجموعة"', '"Explore" button text', 'البانر الرئيسي', 'Hero banner'),
  home('hero.worldsCta', 'Hero banner', 'input', 'نص زر "عوالم اللعب"', '"Worlds of Play" button text', 'البانر الرئيسي', 'Hero banner'),
  // Homepage — World of Play / Categories
  home('cats.curateBy', 'World of Play', 'input', 'تسمية "افرز حسب"', '"Curate by" label', 'قسم عوالم اللعب', 'World of Play section'),
  home('cats.title', 'World of Play', 'input', 'عنوان قسم عوالم اللعب', 'World of Play section title', 'قسم عوالم اللعب', 'World of Play section'),
  home('cats.titleTag', 'World of Play', 'input', 'وسم العنوان (نسخة بديلة)', 'Title tag (alt copy)', 'قسم عوالم اللعب', 'World of Play section'),
  home('cats.subtitle', 'World of Play', 'textarea', 'الوصف تحت العنوان', 'Description under the title', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.build', 'World of Play', 'input', 'اسم فئة "بناء وتركيب"', '"Build & Create" category name', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.buildDesc', 'World of Play', 'input', 'وصف فئة "بناء وتركيب"', '"Build & Create" category tagline', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.plush', 'World of Play', 'input', 'اسم فئة "دمى ناعمة"', '"Plush & Soft" category name', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.plushDesc', 'World of Play', 'input', 'وصف فئة "دمى ناعمة"', '"Plush & Soft" category tagline', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.vehicles', 'World of Play', 'input', 'اسم فئة "مركبات"', '"Vehicles & Motion" category name', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.vehiclesDesc', 'World of Play', 'input', 'وصف فئة "مركبات"', '"Vehicles & Motion" category tagline', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.early', 'World of Play', 'input', 'اسم فئة "السنوات الأولى"', '"Early Years" category name', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.earlyDesc', 'World of Play', 'input', 'وصف فئة "السنوات الأولى"', '"Early Years" category tagline', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.pretend', 'World of Play', 'input', 'اسم فئة "لعب تخيّلي"', '"Pretend Play" category name', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.pretendDesc', 'World of Play', 'input', 'وصف فئة "لعب تخيّلي"', '"Pretend Play" category tagline', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.arts', 'World of Play', 'input', 'اسم فئة "فنون وأشغال"', '"Arts & Crafts" category name', 'قسم عوالم اللعب', 'World of Play section'),
  home('cat.artsDesc', 'World of Play', 'input', 'وصف فئة "فنون وأشغال"', '"Arts & Crafts" category tagline', 'قسم عوالم اللعب', 'World of Play section'),
  // Homepage — Our Promise strip
  home('promise.sustain', 'Our Promise strip', 'input', 'عنوان "خامات آمنة"', '"Safe materials" title', 'شريط وعودنا', 'Our Promise strip'),
  home('promise.sustainDesc', 'Our Promise strip', 'input', 'وصف "خامات آمنة"', '"Safe materials" description', 'شريط وعودنا', 'Our Promise strip'),
  home('promise.pay', 'Our Promise strip', 'input', 'عنوان "طرق الدفع"', '"Payment options" title', 'شريط وعودنا', 'Our Promise strip'),
  home('promise.payDesc', 'Our Promise strip', 'input', 'وصف "طرق الدفع"', '"Payment options" description', 'شريط وعودنا', 'Our Promise strip'),
  home('promise.delivery', 'Our Promise strip', 'input', 'عنوان "التوصيل"', '"Delivery" title', 'شريط وعودنا', 'Our Promise strip'),
  home('promise.deliveryDesc', 'Our Promise strip', 'input', 'وصف "التوصيل"', '"Delivery" description', 'شريط وعودنا', 'Our Promise strip'),
  // Homepage — Recommended for you
  home('rec.label', 'Recommended for you', 'input', 'تسمية صغيرة فوق العنوان', 'Small label above the title', 'قسم المنتجات الموصى بها', 'Recommended products section'),
  home('rec.title', 'Recommended for you', 'input', 'عنوان القسم', 'Section title', 'قسم المنتجات الموصى بها', 'Recommended products section'),
  home('rec.subtitle', 'Recommended for you', 'textarea', 'الوصف تحت العنوان', 'Description under the title', 'قسم المنتجات الموصى بها', 'Recommended products section'),
  home('rec.browse', 'Recommended for you', 'input', 'نص زر "تصفّح الكل"', '"Browse all" button text', 'قسم المنتجات الموصى بها', 'Recommended products section'),
  home('rec.onSale', 'Recommended for you', 'input', 'شارة "خصم"', '"On Sale" badge', 'قسم المنتجات الموصى بها', 'Recommended products section'),
  home('rec.bestSeller', 'Recommended for you', 'input', 'شارة "الأكثر مبيعًا"', '"Best Seller" badge', 'قسم المنتجات الموصى بها', 'Recommended products section'),
  home('rec.topRated', 'Recommended for you', 'input', 'شارة "الأعلى تقييمًا"', '"Top Rated" badge', 'قسم المنتجات الموصى بها', 'Recommended products section'),
  home('rec.new', 'Recommended for you', 'input', 'شارة "جديد"', '"New" badge', 'قسم المنتجات الموصى بها', 'Recommended products section'),
  // Homepage — Newsletter
  home('nl.title', 'Newsletter', 'input', 'عنوان نموذج الاشتراك', 'Signup form title', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.subtitle', 'Newsletter', 'textarea', 'الوصف تحت العنوان', 'Description under the title', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.emailPlaceholder', 'Newsletter', 'input', 'نص توضيحي لحقل البريد', 'Email field placeholder', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.phonePlaceholder', 'Newsletter', 'input', 'نص توضيحي لحقل الهاتف', 'Phone field placeholder', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.subscribe', 'Newsletter', 'input', 'نص زر الاشتراك', 'Subscribe button text', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.subscribing', 'Newsletter', 'input', 'نص أثناء الإرسال', 'Text while submitting', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.subscribed', 'Newsletter', 'input', 'نص بعد نجاح الاشتراك', 'Text after a successful signup', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.successDesc', 'Newsletter', 'input', 'رسالة الترحيب بعد الاشتراك', 'Welcome message after signup', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.errorGeneric', 'Newsletter', 'input', 'رسالة خطأ عامة', 'Generic error message', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.validationRequired', 'Newsletter', 'input', 'رسالة حقل مطلوب', '"Field required" message', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.invalidEmail', 'Newsletter', 'input', 'رسالة بريد إلكتروني غير صالح', 'Invalid email message', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.invalidPhone', 'Newsletter', 'input', 'رسالة رقم هاتف غير صالح', 'Invalid phone message', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.privacyNote', 'Newsletter', 'input', 'ملاحظة إلغاء الاشتراك', 'Unsubscribe note', 'قسم النشرة البريدية', 'Newsletter section'),
  home('nl.spam', 'Newsletter', 'input', 'ملاحظة "بدون رسائل مزعجة"', '"No spam" note', 'قسم النشرة البريدية', 'Newsletter section'),
  // Homepage — Deals
  home('deals.title', 'Deals', 'input', 'عنوان قسم العروض', 'Deals section title', 'قسم العروض', 'Deals section'),
  home('deals.subtitle', 'Deals', 'input', 'الوصف تحت العنوان', 'Description under the title', 'قسم العروض', 'Deals section'),
  home('deals.viewAll', 'Deals', 'input', 'نص زر "عرض كل العروض"', '"View All Deals" button text', 'قسم العروض', 'Deals section'),
  home('deals.empty', 'Deals', 'input', 'رسالة عدم وجود عروض', '"No deals" message', 'قسم العروض', 'Deals section'),

  // Header & Navigation (customer-facing labels only — admin dashboard menu
  // labels are software UI, not content, and are excluded)
  { key: 'nav.home', group: 'nav', type: 'input', label_ar: 'تبويب "الرئيسية"', label_en: '"Home" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.explore', group: 'nav', type: 'input', label_ar: 'تبويب "استكشف"', label_en: '"Explore" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.shop', group: 'nav', type: 'input', label_ar: 'تبويب "تسوّق"', label_en: '"Shop" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.allToys', group: 'nav', type: 'input', label_ar: 'تبويب "كل الألعاب"', label_en: '"All Toys" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.chooseForKids', group: 'nav', type: 'input', label_ar: 'تبويب "اختر لطفلك"', label_en: '"Choose for Kids" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.bundles', group: 'nav', type: 'input', label_ar: 'تبويب "الحزم والباقات"', label_en: '"Bundles & Packages" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.worlds', group: 'nav', type: 'input', label_ar: 'تبويب "عوالم اللعب"', label_en: '"Worlds of Play" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.promise', group: 'nav', type: 'input', label_ar: 'تبويب "وعودنا"', label_en: '"Our Promise" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.about', group: 'nav', type: 'input', label_ar: 'تبويب "من نحن"', label_en: '"About" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.faq', group: 'nav', type: 'input', label_ar: 'تبويب "الأسئلة الشائعة"', label_en: '"FAQ" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.track', group: 'nav', type: 'input', label_ar: 'تبويب "تتبّع الطلب"', label_en: '"Track Order" nav label', location_ar: 'الهيدر وقائمة الجوال', location_en: 'Header & mobile menu' },
  { key: 'nav.cart', group: 'nav', type: 'input', label_ar: 'تسمية "السلة"', label_en: '"Cart" label', location_ar: 'الهيدر', location_en: 'Header' },
  { key: 'nav.wishlist', group: 'nav', type: 'input', label_ar: 'تسمية "المفضلة"', label_en: '"Wishlist" label', location_ar: 'الهيدر', location_en: 'Header' },
  { key: 'nav.search', group: 'nav', type: 'input', label_ar: 'نص توضيحي في مربع البحث', label_en: 'Search box placeholder', location_ar: 'الهيدر', location_en: 'Header' },
  { key: 'nav.shopByGender', group: 'nav', type: 'input', label_ar: 'تبويب "اختر لطفلك" (فلتر)', label_en: '"Shop by Gender" filter label', location_ar: 'الهيدر وصفحة المتجر', location_en: 'Header & Shop page' },
  { key: 'nav.ages', group: 'nav', type: 'input', label_ar: 'تبويب "العمر"', label_en: '"Ages" nav label', location_ar: 'الهيدر', location_en: 'Header' },
  { key: 'nav.signIn', group: 'nav', type: 'input', label_ar: 'زر "تسجيل الدخول"', label_en: '"Sign in" button', location_ar: 'الهيدر', location_en: 'Header' },
  { key: 'nav.signUp', group: 'nav', type: 'input', label_ar: 'زر "إنشاء حساب"', label_en: '"Sign up" button', location_ar: 'الهيدر', location_en: 'Header' },
  { key: 'nav.orders', group: 'nav', type: 'input', label_ar: 'تسمية "طلباتي"', label_en: '"My Orders" label', location_ar: 'قائمة الحساب', location_en: 'Account menu' },
  { key: 'nav.more', group: 'nav', type: 'input', label_ar: 'تسمية "المزيد"', label_en: '"More" label', location_ar: 'قائمة الجوال', location_en: 'Mobile menu' },

  // Footer
  { key: 'footer.tagline', group: 'footer', type: 'textarea', label_ar: 'شعار/جملة الفوتر', label_en: 'Footer tagline', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.shop', group: 'footer', type: 'input', label_ar: 'عنوان عمود "تسوّق"', label_en: '"Shop" column heading', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.allToys', group: 'footer', type: 'input', label_ar: 'رابط "كل الألعاب"', label_en: '"All Toys" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.worlds', group: 'footer', type: 'input', label_ar: 'رابط "عوالم اللعب"', label_en: '"Worlds of Play" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.promise', group: 'footer', type: 'input', label_ar: 'رابط "وعودنا"', label_en: '"Our Promise" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.company', group: 'footer', type: 'input', label_ar: 'عنوان عمود "الشركة"', label_en: '"Company" column heading', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.about', group: 'footer', type: 'input', label_ar: 'رابط "من نحن"', label_en: '"About" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.faq', group: 'footer', type: 'input', label_ar: 'رابط "الأسئلة الشائعة"', label_en: '"FAQ" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.track', group: 'footer', type: 'input', label_ar: 'رابط "تتبّع الطلب"', label_en: '"Track Order" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.careers', group: 'footer', type: 'input', label_ar: 'رابط "وظائف"', label_en: '"Careers" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.contact', group: 'footer', type: 'input', label_ar: 'رابط "تواصل معنا"', label_en: '"Contact" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.trackOrder', group: 'footer', type: 'input', label_ar: 'عنوان "تتبّع طلبك"', label_en: '"Track Your Order" heading', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.follow', group: 'footer', type: 'input', label_ar: 'عنوان "تابعنا"', label_en: '"Follow" heading', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.rights', group: 'footer', type: 'input', label_ar: 'نص حقوق النشر', label_en: 'Copyright text', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.privacy', group: 'footer', type: 'input', label_ar: 'رابط "الخصوصية"', label_en: '"Privacy" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.terms', group: 'footer', type: 'input', label_ar: 'رابط "الشروط"', label_en: '"Terms" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.products', group: 'footer', type: 'input', label_ar: 'عنوان عمود "المنتجات"', label_en: '"Products" column heading', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.categories', group: 'footer', type: 'input', label_ar: 'رابط "الفئات"', label_en: '"Categories" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.offers', group: 'footer', type: 'input', label_ar: 'رابط "العروض"', label_en: '"Offers" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.wishlist', group: 'footer', type: 'input', label_ar: 'رابط "المفضلة"', label_en: '"Wishlist" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.help', group: 'footer', type: 'input', label_ar: 'عنوان عمود "المساعدة"', label_en: '"Help" column heading', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.shipping', group: 'footer', type: 'input', label_ar: 'رابط "الشحن والتوصيل"', label_en: '"Shipping & Delivery" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.returns', group: 'footer', type: 'input', label_ar: 'رابط "الإرجاع والاستبدال"', label_en: '"Returns & Exchanges" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.aboutStore', group: 'footer', type: 'input', label_ar: 'رابط "عن المتجر"', label_en: '"About" link (help column)', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.whyUs', group: 'footer', type: 'input', label_ar: 'رابط "لماذا نحن"', label_en: '"Why Us" link', location_ar: 'الفوتر', location_en: 'Footer' },
  { key: 'footer.legal', group: 'footer', type: 'input', label_ar: 'عنوان عمود "قانوني"', label_en: '"Legal" column heading', location_ar: 'الفوتر', location_en: 'Footer' },

  // Loyalty & Rewards (the customer-facing nav/menu labels for the rewards hub)
  { key: 'nav.challenges', group: 'loyalty', type: 'input', label_ar: 'تسمية "التحديات"', label_en: '"Challenges" label', location_ar: 'قائمة المكافآت', location_en: 'Rewards menu' },
  { key: 'nav.wheel', group: 'loyalty', type: 'input', label_ar: 'تسمية "عجلة الحظ"', label_en: '"Mystery Wheel" label', location_ar: 'قائمة المكافآت', location_en: 'Rewards menu' },
  { key: 'nav.rewards', group: 'loyalty', type: 'input', label_ar: 'تسمية "المكافآت"', label_en: '"Rewards" label', location_ar: 'قائمة الحساب', location_en: 'Account menu' },
  { key: 'nav.wheelRewards', group: 'loyalty', type: 'input', label_ar: 'تسمية "مكافآتي"', label_en: '"My Rewards" label', location_ar: 'قائمة الحساب', location_en: 'Account menu' },
  { key: 'nav.rewardsChallengesDesc', group: 'loyalty', type: 'input', label_ar: 'وصف بطاقة التحديات', label_en: 'Challenges card description', location_ar: 'قائمة المكافآت', location_en: 'Rewards menu' },
  { key: 'nav.rewardsWheelDesc', group: 'loyalty', type: 'input', label_ar: 'وصف بطاقة عجلة الحظ', label_en: 'Mystery Wheel card description', location_ar: 'قائمة المكافآت', location_en: 'Rewards menu' },
  { key: 'nav.rewardsMyRewardsDesc', group: 'loyalty', type: 'input', label_ar: 'وصف بطاقة "مكافآتي"', label_en: '"My Rewards" card description', location_ar: 'قائمة المكافآت', location_en: 'Rewards menu' },

  // About (static page shell text — separate from the About tab's own
  // story/values/CTA content, which is edited in the "About" tab instead)
  { key: 'about.heading', group: 'about', type: 'input', label_ar: 'تسمية صغيرة فوق العنوان', label_en: 'Small label above the title', location_ar: 'مقتطف "من نحن" على الصفحة الرئيسية', location_en: 'Homepage "About" teaser' },
  { key: 'about.title', group: 'about', type: 'textarea', label_ar: 'العنوان', label_en: 'Title', location_ar: 'مقتطف "من نحن" على الصفحة الرئيسية', location_en: 'Homepage "About" teaser' },
  { key: 'about.body', group: 'about', type: 'textarea', label_ar: 'النص', label_en: 'Body text', location_ar: 'مقتطف "من نحن" على الصفحة الرئيسية', location_en: 'Homepage "About" teaser' },
  { key: 'about.curated', group: 'about', type: 'input', label_ar: 'شارة "منتقاة بعناية"', label_en: '"Curated toys" badge', location_ar: 'مقتطف "من نحن" على الصفحة الرئيسية', location_en: 'Homepage "About" teaser' },
  { key: 'about.safe', group: 'about', type: 'input', label_ar: 'شارة "خامات آمنة"', label_en: '"Safe materials" badge', location_ar: 'مقتطف "من نحن" على الصفحة الرئيسية', location_en: 'Homepage "About" teaser' },
  { key: 'aboutPage.hero', group: 'about', type: 'input', label_ar: 'عنوان صفحة "من نحن"', label_en: 'About page heading', location_ar: 'أعلى صفحة "من نحن"', location_en: 'Top of the About page' },
  { key: 'aboutPage.heroSub', group: 'about', type: 'input', label_ar: 'الوصف تحت العنوان', label_en: 'Subheading', location_ar: 'أعلى صفحة "من نحن"', location_en: 'Top of the About page' },

  // FAQ (page intro — the actual questions/answers are edited in the "FAQ" tab)
  { key: 'faq.title', group: 'faq', type: 'input', label_ar: 'عنوان صفحة الأسئلة الشائعة', label_en: 'FAQ page title', location_ar: 'أعلى صفحة الأسئلة الشائعة', location_en: 'Top of the FAQ page' },
  { key: 'faq.subtitle', group: 'faq', type: 'input', label_ar: 'الوصف تحت العنوان', label_en: 'Subheading', location_ar: 'أعلى صفحة الأسئلة الشائعة', location_en: 'Top of the FAQ page' },

  // Contact
  { key: 'contact.title', group: 'contact', type: 'input', label_ar: 'عنوان صفحة التواصل', label_en: 'Contact page title', location_ar: 'صفحة تواصل معنا', location_en: 'Contact page' },
  { key: 'contact.subtitle', group: 'contact', type: 'textarea', label_ar: 'الوصف تحت العنوان', label_en: 'Subheading', location_ar: 'صفحة تواصل معنا', location_en: 'Contact page' },
  { key: 'contact.emailLabel', group: 'contact', type: 'input', label_ar: 'تسمية "البريد الإلكتروني"', label_en: '"Email" label', location_ar: 'صفحة تواصل معنا', location_en: 'Contact page' },
  { key: 'contact.whatsappLabel', group: 'contact', type: 'input', label_ar: 'تسمية "واتساب"', label_en: '"WhatsApp" label', location_ar: 'صفحة تواصل معنا', location_en: 'Contact page' },
  { key: 'contact.addressTitle', group: 'contact', type: 'input', label_ar: 'عنوان "أين نحن"', label_en: '"Where we are" heading', location_ar: 'صفحة تواصل معنا', location_en: 'Contact page' },
  { key: 'contact.hoursTitle', group: 'contact', type: 'input', label_ar: 'عنوان "ساعات الرد"', label_en: '"Response hours" heading', location_ar: 'صفحة تواصل معنا', location_en: 'Contact page' },

  // General Messages (shared buttons/labels used across the storefront)
  { key: 'common.addToCart', group: 'common', type: 'input', label_ar: 'زر "أضف إلى السلة"', label_en: '"Add to cart" button', location_ar: 'بطاقات المنتجات وصفحة المنتج', location_en: 'Product cards & product page' },
  { key: 'common.add', group: 'common', type: 'input', label_ar: 'زر "إضافة"', label_en: '"Add" button', location_ar: 'مواضع متعددة في المتجر', location_en: 'Multiple storefront spots' },
  { key: 'common.buyNow', group: 'common', type: 'input', label_ar: 'زر "اشترِ الآن"', label_en: '"Buy now" button', location_ar: 'صفحة المنتج', location_en: 'Product page' },
  { key: 'common.added', group: 'common', type: 'input', label_ar: 'رسالة "أُضيف إلى السلة"', label_en: '"Added to cart" message', location_ar: 'مواضع متعددة في المتجر', location_en: 'Multiple storefront spots' },
  { key: 'common.viewCart', group: 'common', type: 'input', label_ar: 'رابط "عرض السلة"', label_en: '"View cart" link', location_ar: 'مواضع متعددة في المتجر', location_en: 'Multiple storefront spots' },
  { key: 'common.continue', group: 'common', type: 'input', label_ar: 'رابط "متابعة التسوق"', label_en: '"Continue shopping" link', location_ar: 'السلة', location_en: 'Cart' },
  { key: 'common.checkout', group: 'common', type: 'input', label_ar: 'زر "إتمام الطلب"', label_en: '"Checkout" button', location_ar: 'السلة', location_en: 'Cart' },
  { key: 'common.subtotal', group: 'common', type: 'input', label_ar: 'تسمية "المجموع الفرعي"', label_en: '"Subtotal" label', location_ar: 'السلة والدفع', location_en: 'Cart & checkout' },
  { key: 'common.viewDetails', group: 'common', type: 'input', label_ar: 'رابط "عرض التفاصيل"', label_en: '"View Details" link', location_ar: 'مواضع متعددة في المتجر', location_en: 'Multiple storefront spots' },
  { key: 'common.delivery', group: 'common', type: 'input', label_ar: 'تسمية "التوصيل"', label_en: '"Delivery" label', location_ar: 'السلة والدفع', location_en: 'Cart & checkout' },
  { key: 'common.total', group: 'common', type: 'input', label_ar: 'تسمية "الإجمالي"', label_en: '"Total" label', location_ar: 'السلة والدفع', location_en: 'Cart & checkout' },
  { key: 'common.free', group: 'common', type: 'input', label_ar: 'تسمية "مجاني"', label_en: '"Free" label', location_ar: 'السلة والدفع', location_en: 'Cart & checkout' },
  { key: 'common.days', group: 'common', type: 'input', label_ar: 'كلمة "أيام"', label_en: '"days" word', location_ar: 'مواضع متعددة', location_en: 'Multiple spots' },
  { key: 'common.calculatedAtCheckout', group: 'common', type: 'input', label_ar: 'رسالة "يُحسب عند الدفع"', label_en: '"Calculated at checkout" message', location_ar: 'السلة', location_en: 'Cart' },
  { key: 'common.back', group: 'common', type: 'input', label_ar: 'رابط "رجوع"', label_en: '"Back" link', location_ar: 'مواضع متعددة', location_en: 'Multiple spots' },
  { key: 'common.loading', group: 'common', type: 'input', label_ar: 'رسالة "جارِ التحميل"', label_en: '"Loading" message', location_ar: 'مواضع متعددة', location_en: 'Multiple spots' },
  { key: 'common.clear', group: 'common', type: 'input', label_ar: 'زر "مسح الفلاتر"', label_en: '"Clear filters" button', location_ar: 'صفحة المتجر', location_en: 'Shop page' },
  { key: 'common.found', group: 'common', type: 'input', label_ar: 'كلمة "منتجات موجودة"', label_en: '"products found" text', location_ar: 'صفحة المتجر', location_en: 'Shop page' },
  { key: 'common.foundOne', group: 'common', type: 'input', label_ar: 'كلمة "منتج موجود" (مفرد)', label_en: '"product found" text (singular)', location_ar: 'صفحة المتجر', location_en: 'Shop page' },
  { key: 'common.noMatch', group: 'common', type: 'input', label_ar: 'رسالة "لا نتائج"', label_en: '"No toys match" message', location_ar: 'صفحة المتجر', location_en: 'Shop page' },
  { key: 'common.tryWiden', group: 'common', type: 'input', label_ar: 'اقتراح "وسّع بحثك"', label_en: '"Try widening your search" hint', location_ar: 'صفحة المتجر', location_en: 'Shop page' },
];

export const metaForKey = (key) => TEXT_FIELD_META.find((m) => m.key === key);
