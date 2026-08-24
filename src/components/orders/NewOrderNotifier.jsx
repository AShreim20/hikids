import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { usePermissions } from '@/lib/permissions';
import { useLanguage } from '@/context/LanguageContext';
import { orderRef, orderItemCount, statusLabel } from '@/lib/orderStatus';

// Real-time new-order alerts for staff who can manage orders — no refresh needed.
export default function NewOrderNotifier() {
  const { can } = usePermissions();
  const { lang, formatPrice } = useLanguage();
  const navigate = useNavigate();
  const allowed = can('orders.manage');
  const seen = useRef(new Set());

  useEffect(() => {
    if (!allowed) return;
    const unsubscribe = base44.entities.Order.subscribe((event) => {
      if (event.type !== 'create' || !event.data) return;
      const o = event.data;
      if (seen.current.has(o.id)) return;
      seen.current.add(o.id);
      const ar = lang === 'ar';
      toast({
        title: `${ar ? 'طلب جديد' : 'New Order'} #${orderRef(o)}`,
        description:
          `${ar ? 'الزبون' : 'Customer'}: ${o.customer_name || '—'} · ` +
          `${ar ? 'الإجمالي' : 'Total'}: ${formatPrice(o.total)} · ` +
          `${ar ? 'القطع' : 'Items'}: ${orderItemCount(o)} · ` +
          `${ar ? 'الحالة' : 'Status'}: ${statusLabel(o.status, lang)}`,
      });
    });
    return unsubscribe;
  }, [allowed, lang, formatPrice, navigate]);

  return null;
}