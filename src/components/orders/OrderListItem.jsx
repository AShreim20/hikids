import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, MessageCircle, Phone } from 'lucide-react';
import { statusLabel, statusColor, orderRef, orderItemCount } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';

// One order in the management list — card layout that stays readable on mobile.
export default function OrderListItem({ order }) {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const date = new Date(order.created_date);
  const waNumber = String(order.phone || '').replace(/[^\d]/g, '');

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to={`/orders-admin/${order.id}`} className="font-heading font-bold hover:text-cosmic">
            #{orderRef(order)}
          </Link>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {order.customer_name} · {order.phone}
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold ${statusColor(order.status)}`}>
          {statusLabel(order.status, lang)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{ar ? 'التاريخ' : 'Date'}</p>
          <p className="font-medium">{date.toLocaleDateString(ar ? 'ar' : 'en')} · {date.toLocaleTimeString(ar ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{ar ? 'المدينة' : 'City'}</p>
          <p className="font-medium">{order.city || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{ar ? 'القطع' : 'Items'}</p>
          <p className="font-medium">{orderItemCount(order)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{ar ? 'الإجمالي' : 'Total'}</p>
          <p className="font-heading font-bold">{formatPrice(order.total)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/orders-admin/${order.id}`}
          className="squish inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-sm"
        >
          <Eye className="w-4 h-4" /> {ar ? 'عرض' : 'View'}
        </Link>
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noreferrer"
            className="squish inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        )}
        {order.phone && (
          <a
            href={`tel:${order.phone}`}
            className="squish inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm"
          >
            <Phone className="w-4 h-4" /> {ar ? 'اتصال' : 'Call'}
          </a>
        )}
      </div>
    </div>
  );
}