import React from 'react';
import { MessageCircle, Phone, Mail } from 'lucide-react';
import { orderRef, normalizeStatus } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';

// Pre-written WhatsApp messages per lifecycle stage + direct call / email.
const TEMPLATES = {
  en: {
    confirmed: 'Your order {ref} has been confirmed. Thank you!',
    preparing: 'Your order {ref} is being prepared.',
    ready: 'Your order {ref} is packed and ready for delivery.',
    out_for_delivery: 'Your order {ref} is out for delivery.',
    delivered: 'Your order {ref} has been delivered. Enjoy!',
    cancelled: 'Your order {ref} has been cancelled.',
  },
  ar: {
    confirmed: 'تم تأكيد طلبك {ref}. شكرًا لك!',
    preparing: 'جارٍ تجهيز طلبك {ref}.',
    ready: 'طلبك {ref} جاهز للتوصيل.',
    out_for_delivery: 'طلبك {ref} في الطريق إليك.',
    delivered: 'تم تسليم طلبك {ref}. نتمنى لك تجربة ممتعة!',
    cancelled: 'تم إلغاء طلبك {ref}.',
  },
};

export default function ContactCustomer({ order }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const wa = String(order.phone || '').replace(/[^\d]/g, '');
  const ref = orderRef(order);
  const templates = TEMPLATES[ar ? 'ar' : 'en'];
  const current = normalizeStatus(order.status);

  const link = (text) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl">{ar ? 'التواصل مع الزبون' : 'Contact customer'}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="squish inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-emerald-600 text-white font-heading font-bold text-sm">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        )}
        {order.phone && (
          <a href={`tel:${order.phone}`} className="squish inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-mist font-heading font-bold text-sm">
            <Phone className="w-4 h-4" /> {ar ? 'اتصال' : 'Call'}
          </a>
        )}
        {order.customer_email && (
          <a href={`mailto:${order.customer_email}`} className="squish inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-mist font-heading font-bold text-sm">
            <Mail className="w-4 h-4" /> {ar ? 'بريد' : 'Email'}
          </a>
        )}
      </div>

      {wa && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {ar ? 'رسائل جاهزة' : 'Quick messages'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(templates).map(([key, text]) => (
              <a
                key={key}
                href={link(text.replace('{ref}', `#${ref}`))}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center h-9 px-3 rounded-full text-xs font-heading font-bold border transition-colors ${
                  key === current ? 'border-cosmic bg-cosmic/10 text-cosmic' : 'border-border bg-mist hover:border-cosmic/40'
                }`}
              >
                {text.replace('{ref}', `#${ref}`)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}