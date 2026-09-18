import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Search, ChevronRight, ChevronLeft, Inbox } from 'lucide-react';
import { db } from '@/api/entities';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';
import { orderRef } from '@/lib/orderStatus';
import {
  ADMIN_STATUS_TABS, returnRequestStatusLabel, REQUEST_TYPE_LABEL,
  deliveryResponsibilityLabel,
} from '@/lib/returns';

const STATUS_PILL_CLASS = {
  draft: 'bg-mist text-muted-foreground',
  submitted: 'bg-cosmic/10 text-cosmic',
  under_review: 'bg-amber-100 text-amber-700',
  needs_information: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-destructive/10 text-destructive',
  awaiting_return: 'bg-sky-100 text-sky-700',
  received: 'bg-sky-100 text-sky-700',
  processing: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-700',
};

export default function ReturnRequestsAdmin() {
  const { t, lang } = useLanguage();
  const { can } = usePermissions();
  const ar = lang === 'ar';
  const allowed = can('returns.manage');

  const [requests, setRequests] = useState([]);
  const [itemsByRequest, setItemsByRequest] = useState({});
  const [ordersById, setOrdersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [reqs, items, orders] = await Promise.all([
        db.ReturnRequest.list('-created_date', 500),
        db.ReturnRequestItem.list('-created_date', 2000),
        db.Order.list('-created_date', 500),
      ]);
      setRequests(reqs || []);
      const grouped = {};
      for (const it of items || []) (grouped[it.return_request_id] ||= []).push(it);
      setItemsByRequest(grouped);
      setOrdersById(Object.fromEntries((orders || []).map((o) => [o.id, o])));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return requests
      .filter((r) => statusTab === 'all' || r.status === statusTab)
      .filter((r) => !typeFilter || r.request_type === typeFilter)
      .filter((r) => {
        if (!term) return true;
        const order = ordersById[r.order_id];
        const haystack = [
          r.request_code, order?.customer_name, order?.customer_email, order?.phone,
          order ? orderRef(order) : '',
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      });
  }, [requests, statusTab, typeFilter, q, ordersById]);

  const Chevron = ar ? ChevronLeft : ChevronRight;

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('admin.deniedDesc')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('admin.title')}</Link>
        <div className="mt-6">
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{ar ? 'المرتجعات والاستبدال' : 'Returns & Exchanges'}</p>
          <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{ar ? 'طلبات الإرجاع والاستبدال' : 'Return & Exchange Requests'}</h1>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {ADMIN_STATUS_TABS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusTab(s)}
              className={`shrink-0 h-10 px-4 rounded-full text-sm font-heading font-bold transition-colors ${
                statusTab === s ? 'bg-cosmic text-white' : 'bg-mist text-foreground hover:bg-cosmic/10'
              }`}
            >
              {s === 'all' ? (ar ? 'الكل' : 'All') : returnRequestStatusLabel(s, lang)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? 'رقم الطلب، الطلب الأصلي، أو الزبون' : 'RET code, order, or customer'}
              className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-11 px-4 rounded-2xl bg-mist border border-border text-sm"
          >
            <option value="">{ar ? 'كل الأنواع' : 'All types'}</option>
            <option value="return">{REQUEST_TYPE_LABEL.return[lang]}</option>
            <option value="exchange">{REQUEST_TYPE_LABEL.exchange[lang]}</option>
          </select>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-3xl bg-mist animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist"><Inbox className="w-8 h-8 text-muted-foreground" /></div>
            <p className="mt-5 font-heading font-bold text-xl">{ar ? 'لا توجد طلبات مطابقة' : 'No matching requests'}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {filtered.map((r) => {
              const order = ordersById[r.order_id];
              const items = itemsByRequest[r.id] || [];
              const delivery = items[0]?.reason_policy_snapshot?.delivery_responsibility;
              return (
                <Link
                  key={r.id}
                  to={`/admin/return-requests/${r.id}`}
                  className="flex items-center justify-between gap-4 rounded-3xl bg-card border border-border/60 p-5 hover:border-cosmic/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-heading font-bold" dir="ltr">{r.request_code}</p>
                      <span className="text-xs text-muted-foreground">
                        {REQUEST_TYPE_LABEL[r.request_type]?.[lang] || r.request_type} · {items.length} {ar ? 'صنف' : 'item(s)'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {order ? `${orderRef(order)} · ${order.customer_name}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(r.created_date).toLocaleString(ar ? 'ar-u-nu-latn' : 'en')}
                      {delivery && ` · ${deliveryResponsibilityLabel(delivery, lang)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold whitespace-nowrap ${STATUS_PILL_CLASS[r.status] || 'bg-mist text-muted-foreground'}`}>
                      {returnRequestStatusLabel(r.status, lang)}
                    </span>
                    <Chevron className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
