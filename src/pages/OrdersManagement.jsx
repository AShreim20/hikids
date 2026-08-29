import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Package } from 'lucide-react';
import { db } from '@/api/entities';
import { subscribeOrders } from '@/lib/orderRealtime';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import OrderStatsCards from '@/components/orders/OrderStatsCards';
import OrderFilters from '@/components/orders/OrderFilters';
import OrderListItem from '@/components/orders/OrderListItem';
import { PreviewInvoiceButton } from '@/components/orders/OrderInvoice';
import { usePermissions } from '@/lib/permissions';
import { useLanguage } from '@/context/LanguageContext';
import {
  MAIN_FLOW, RETURN_STATUSES, normalizeStatus, statusLabel,
} from '@/lib/orderStatus';

const TABS = ['all', ...MAIN_FLOW, 'cancelled', 'returns'];

export default function OrdersManagement() {
  const { can } = usePermissions();
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState({
    q: '', city: '', payment: '', paymentStatus: '', from: '', to: '', sort: 'newest',
  });

  const allowed = can('orders.manage');

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    db.Order.list('-created_date', 500)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
    const unsubscribe = subscribeOrders((event) => {
      if (event.type === 'create') setOrders((prev) => [event.data, ...prev]);
      if (event.type === 'update') setOrders((prev) => prev.map((o) => (o.id === event.data.id ? event.data : o)));
      if (event.type === 'delete') setOrders((prev) => prev.filter((o) => o.id !== event.id));
    });
    return unsubscribe;
  }, [allowed]);

  const cities = useMemo(
    () => Array.from(new Set(orders.map((o) => o.city).filter(Boolean))),
    [orders]
  );

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let list = orders.filter((o) => {
      const s = normalizeStatus(o.status);
      if (tab === 'returns' && !RETURN_STATUSES.includes(s)) return false;
      if (tab !== 'all' && tab !== 'returns' && s !== tab) return false;
      if (filters.city && o.city !== filters.city) return false;
      if (filters.payment && o.payment_method !== filters.payment) return false;
      if (filters.paymentStatus && (o.payment_status || 'unpaid') !== filters.paymentStatus) return false;
      if (filters.from && new Date(o.created_date) < new Date(filters.from)) return false;
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.created_date) > end) return false;
      }
      if (q) {
        const hay = [
          o.id, o.customer_name, o.phone, o.customer_email, o.city,
          ...(o.items || []).map((i) => i.name),
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const by = {
      newest: (a, b) => new Date(b.created_date) - new Date(a.created_date),
      oldest: (a, b) => new Date(a.created_date) - new Date(b.created_date),
      total_desc: (a, b) => Number(b.total || 0) - Number(a.total || 0),
      total_asc: (a, b) => Number(a.total || 0) - Number(b.total || 0),
      status: (a, b) => normalizeStatus(a.status).localeCompare(normalizeStatus(b.status)),
      customer: (a, b) => String(a.customer_name || '').localeCompare(String(b.customer_name || '')),
    };
    return [...list].sort(by[filters.sort] || by.newest);
  }, [orders, tab, filters]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={ar ? 'الطلبات' : 'Orders'} />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">
            {ar ? 'غير مصرَّح' : 'Not authorized'}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {ar ? 'هذه الصفحة مخصصة للإدارة والموظفين المصرَّح لهم.' : 'This page is for admins and authorized staff.'}
          </p>
          <Link to="/" className="mt-6 inline-flex h-12 px-6 items-center rounded-full bg-cosmic text-white font-heading font-bold squish">
            {ar ? 'العودة للمتجر' : 'Back to store'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={ar ? 'الطلبات والمبيعات' : 'Orders & Sales'} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl">
              {ar ? 'الطلبات والمبيعات' : 'Orders & Sales'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {ar ? 'متابعة وإدارة كل طلبات الزبائن.' : 'Track and manage every customer order.'}
            </p>
          </div>
          <PreviewInvoiceButton />
        </div>

        <div className="mt-8">
          <OrderStatsCards orders={orders} active={tab} onPick={setTab} />
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={`shrink-0 h-10 px-4 rounded-full text-sm font-heading font-bold transition-colors ${
                tab === s ? 'bg-cosmic text-white' : 'bg-mist text-foreground hover:bg-cosmic/10'
              }`}
            >
              {s === 'all' ? (ar ? 'الكل' : 'All') : s === 'returns' ? (ar ? 'الإرجاع' : 'Returns') : statusLabel(s, lang)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <OrderFilters value={filters} onChange={setFilters} cities={cities} />
        </div>

        {loading ? (
          <div className="mt-6 grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-3xl bg-mist animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="mt-5 font-heading font-bold text-xl">
              {ar ? 'لا توجد طلبات مطابقة' : 'No matching orders'}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {visible.map((o) => (
              <OrderListItem key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}