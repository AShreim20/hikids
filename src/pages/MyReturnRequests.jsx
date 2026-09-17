import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Undo2, Lock, ChevronRight, ChevronLeft } from 'lucide-react';
import { db } from '@/api/entities';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { returnRequestStatusLabel, REQUEST_TYPE_LABEL } from '@/lib/returns';

export default function MyReturnRequests() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const ar = lang === 'ar';
  const [requests, setRequests] = useState([]);
  const [itemCounts, setItemCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      db.ReturnRequest.list('-created_date', 100),
      db.ReturnRequestItem.list('-created_date', 500),
    ]).then(([reqs, items]) => {
      setRequests(reqs || []);
      const counts = {};
      for (const it of items || []) counts[it.return_request_id] = (counts[it.return_request_id] || 0) + 1;
      setItemCounts(counts);
    }).catch(() => { setRequests([]); }).finally(() => setLoading(false));
  }, [user]);

  const Chevron = ar ? ChevronLeft : ChevronRight;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('returns.myRequests')} />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist"><Lock className="w-8 h-8 text-muted-foreground" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-2xl">{t('orders.signIn')}</h1>
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{t('settings.signIn')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('returns.myRequests')} />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12">
        <h1 className="font-heading font-extrabold text-4xl md:text-5xl">{t('returns.myRequests')}</h1>
        <p className="mt-3 text-muted-foreground">{t('returns.myRequestsSubtitle')}</p>

        {loading ? (
          <div className="mt-10 grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-3xl bg-mist animate-pulse" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist"><Undo2 className="w-8 h-8 text-muted-foreground" /></div>
            <p className="mt-6 font-heading font-bold text-2xl">{t('returns.empty')}</p>
            <p className="mt-2 text-muted-foreground">{t('returns.emptyDesc')}</p>
            <Link to="/orders" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('orders.title')}</Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-3">
            {requests.map((r) => (
              <Link
                key={r.id}
                to={`/returns/${r.id}`}
                className="flex items-center justify-between gap-4 rounded-3xl bg-card border border-border/60 p-5 hover:border-cosmic/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-heading font-bold" dir="ltr">{r.request_code}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {REQUEST_TYPE_LABEL[r.request_type]?.[lang] || r.request_type} · {itemCounts[r.id] || 0} {t('returns.items')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.created_date).toLocaleDateString(ar ? 'ar-u-nu-latn' : 'en')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill status={r.status} lang={lang} />
                  <Chevron className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

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

function StatusPill({ status, lang }) {
  return (
    <span className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold whitespace-nowrap ${STATUS_PILL_CLASS[status] || 'bg-mist text-muted-foreground'}`}>
      {returnRequestStatusLabel(status, lang)}
    </span>
  );
}
