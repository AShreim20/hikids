import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { db } from '@/api/entities';
import { useLanguage } from '@/context/LanguageContext';
import { returnRequestStatusLabel } from '@/lib/returns';

// Return / exchange requests belong to the invoice they came from -- listed on
// the order itself so the whole history reads in one place.
export default function OrderReturnsList({ orderId, admin = false, bare = false }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [rows, setRows] = useState([]);

  useEffect(() => {
    db.ReturnRequest.filter({ order_id: orderId }, '-created_date', 20)
      .then((r) => setRows((r || []).filter((x) => x.status !== 'draft')))
      .catch(() => setRows([]));
  }, [orderId]);

  if (!rows.length) return null;

  const list = (
    <div className="grid gap-2">
      {rows.map((r) => (
        <Link
          key={r.id}
          to={admin ? `/admin/return-requests/${r.id}` : `/returns/${r.id}`}
          className="flex items-center justify-between gap-3 rounded-2xl bg-mist/60 px-4 py-3 text-sm hover:bg-mist"
        >
          <span className="font-heading font-bold" dir="ltr">{r.request_code}</span>
          <span className="text-muted-foreground">{r.request_type === 'exchange' ? (ar ? 'استبدال' : 'Exchange') : (ar ? 'إرجاع' : 'Return')}</span>
          <span className="font-heading font-bold text-cosmic">{returnRequestStatusLabel(r.status, lang)}</span>
        </Link>
      ))}
    </div>
  );
  if (bare) return <div className="mt-4 pt-4 border-t border-border/60">{list}</div>;

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl flex items-center gap-2"><Undo2 className="w-5 h-5" /> {ar ? 'الإرجاع والاستبدال' : 'Returns & Exchanges'}</h2>
      <div className="mt-3">{list}</div>
    </div>
  );
}
