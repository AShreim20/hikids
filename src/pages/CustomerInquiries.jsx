import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Phone, Mail, Search, MessageCircleQuestion } from 'lucide-react';
import { db } from '@/api/entities';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { usePermissions } from '@/lib/permissions';
import { useLanguage } from '@/context/LanguageContext';

// Admin view of the FAQ page's question form submissions (see
// src/components/faq/InquiryForm.jsx + supabase/migrations/
// 0019_customer_inquiries.sql). Gated on the same `customers.manage`
// permission OrderDetail.jsx already uses for this exact category of data
// (customer name/phone/email) — see 0023_customer_inquiries_permission.sql
// for the matching RLS change; the `can('customers.manage')` check below is
// the friendly denied-screen, not the actual security boundary.
const STATUSES = ['new', 'reviewed', 'replied'];
const statusLabel = (st, ar) => ({
  new: ar ? 'جديد' : 'New',
  reviewed: ar ? 'تمت المراجعة' : 'Reviewed',
  replied: ar ? 'تم الرد' : 'Replied',
}[st] || st);
const statusCls = (st) => ({
  new: 'bg-accent/10 text-accent',
  reviewed: 'bg-amber-100 text-amber-700',
  replied: 'bg-emerald-100 text-emerald-700',
}[st] || 'bg-mist text-muted-foreground');

export default function CustomerInquiries() {
  const { can } = usePermissions();
  const allowed = can('customers.manage');
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = () => {
    setLoading(true);
    db.CustomerInquiry.list('-created_date', 500)
      .then(setInquiries)
      .catch(() => setInquiries([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);

  // Newest unanswered first: "new" ahead of "reviewed" ahead of "replied",
  // each group already newest-first from the query above.
  const sorted = useMemo(() => {
    const rank = { new: 0, reviewed: 1, replied: 2 };
    return [...inquiries].sort((a, b) => (rank[a.status] ?? 0) - (rank[b.status] ?? 0));
  }, [inquiries]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter((i) => {
      if (status && i.status !== status) return false;
      if (needle) {
        const hay = [i.customer_name, i.customer_phone, i.customer_email, i.question].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [sorted, q, status]);

  const newCount = inquiries.filter((i) => i.status === 'new').length;
  const setInquiryStatus = async (i, st) => { await db.CustomerInquiry.update(i.id, { status: st }); load(); };

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{ar ? 'محمي' : 'Access denied'}</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{ar ? 'العودة' : 'Back'}</Link>
        </div><Footer />
      </div>
    );
  }

  const input = 'h-11 px-3 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 text-sm';

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/admin" className="text-sm text-muted-foreground">← {ar ? 'العودة' : 'Back'}</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-accent/10 text-accent"><MessageCircleQuestion className="w-6 h-6" /></div>
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl flex items-center gap-3">
              {ar ? 'استفسارات العملاء' : 'Customer Inquiries'}
              {newCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full bg-accent text-white text-sm font-heading font-bold">
                  {newCount}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">{ar ? 'الأسئلة المرسلة من صفحة الأسئلة الشائعة' : 'Questions submitted from the FAQ page'}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 rounded-3xl bg-card border border-border/60 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
            <input className={`${input} w-full ps-9`} placeholder={ar ? 'بحث: اسم، هاتف، بريد، سؤال…' : 'Search: name, phone, email, question…'} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{ar ? 'كل الحالات' : 'All statuses'}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, ar)}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="mt-8 grid place-items-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">{ar ? 'لا توجد نتائج' : 'No results'}</p>
        ) : (
          <div className="mt-6 space-y-3">
            {filtered.map((i) => {
              const isOpen = openId === i.id;
              return (
                <div key={i.id} className="rounded-3xl bg-card border border-border/60 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : i.id)}
                    className="w-full flex items-start justify-between gap-3 text-start"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-heading font-bold">{i.customer_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-heading font-bold ${statusCls(i.status)}`}>{statusLabel(i.status, ar)}</span>
                      </div>
                      <p className={`mt-1 text-sm text-muted-foreground ${isOpen ? '' : 'line-clamp-1'}`}>{i.question}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(i.created_date).toLocaleString(ar ? 'ar-u-nu-latn' : 'en')}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                        {i.customer_phone && (
                          <a href={`tel:${i.customer_phone}`} className="inline-flex items-center gap-1.5 hover:text-cosmic"><Phone className="w-3.5 h-3.5" /> {i.customer_phone}</a>
                        )}
                        {i.customer_email && (
                          <a href={`mailto:${i.customer_email}`} className="inline-flex items-center gap-1.5 hover:text-cosmic"><Mail className="w-3.5 h-3.5" /> {i.customer_email}</a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={i.status === s}
                            onClick={() => setInquiryStatus(i, s)}
                            className={`h-8 px-3 rounded-full text-xs font-heading font-bold transition-colors ${
                              i.status === s ? `${statusCls(s)} cursor-default` : 'bg-mist text-muted-foreground hover:bg-cosmic hover:text-white'
                            }`}
                          >
                            {statusLabel(s, ar)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
