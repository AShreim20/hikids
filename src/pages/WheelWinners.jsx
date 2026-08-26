import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Phone, Mail, Search, Trophy, Ticket, Package, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { rewardLabel } from '@/lib/rewards';
import { spinRewardName, spinProductName } from '@/lib/bilingual';

const expired = (s) => s.expires_at && new Date(s.expires_at) < new Date();
const statusOf = (s) => {
  if (s.status === 'used') return 'used';
  if (s.status === 'unavailable') return 'unavailable';
  if (s.status === 'expired' || expired(s)) return 'expired';
  return 'unused';
};
const statusLabel = (st, ar) => ({ used: ar ? 'مستخدم' : 'Used', unused: ar ? 'غير مستخدم' : 'Unused', expired: ar ? 'منتهي' : 'Expired', unavailable: ar ? 'غير متاح' : 'Unavailable' }[st]);
const statusCls = (st) => ({ used: 'bg-emerald-100 text-emerald-700', unused: 'bg-cosmic/10 text-cosmic', expired: 'bg-amber-100 text-amber-700', unavailable: 'bg-destructive/10 text-destructive' }[st]);

const TYPES = ['points', 'discount_percent', 'discount_fixed', 'free_delivery', 'product', 'credit'];
const STATUSES = ['unused', 'used', 'expired', 'unavailable'];

export default function WheelWinners() {
  const { user } = useAuth();
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [spins, setSpins] = useState([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    setLoading(true);
    base44.entities.WheelSpin.list('-created_date', 500)
      .then(setSpins)
      .catch(() => setSpins([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (user?.role === 'admin') load(); else setLoading(false); }, [user]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (spins || []).filter((s) => {
      if (type && s.reward_type !== type) return false;
      if (status && statusOf(s) !== status) return false;
      if (from && new Date(s.created_date) < new Date(from)) return false;
      if (to && new Date(s.created_date) > new Date(to + 'T23:59:59')) return false;
      if (t) {
        const hay = [s.customer_name, s.customer_phone, s.user_email, s.reward_label, s.reward_label_en, s.discount_code, s.redeemed_order_id, String(s.id)].join(' ').toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [spins, q, type, status, from, to]);

  const setSpinStatus = async (s, st) => { await base44.entities.WheelSpin.update(s.id, { status: st }); load(); };

  if (user?.role !== 'admin') {
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

  const input = "h-11 px-3 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 text-sm";
  const Icon = (s) => s.reward_type === 'points' ? Sparkles : (s.reward_type === 'product' ? Package : Ticket);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/" className="text-sm text-muted-foreground">← {ar ? 'العودة' : 'Back'}</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-accent/10 text-accent"><Trophy className="w-6 h-6" /></div>
          <div><h1 className="font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'الفائزون' : 'Wheel Winners'}</h1><p className="text-muted-foreground text-sm">{ar ? 'كل من ربح من العجلة' : 'Everyone who won from the wheel'}</p></div>
        </div>

        {/* Filters */}
        <div className="mt-6 rounded-3xl bg-card border border-border/60 p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
            <input className={`${input} w-full ps-9`} placeholder={ar ? 'بحث: اسم، هاتف، كود، طلب…' : 'Search: name, phone, code, order…'} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={input} value={type} onChange={(e) => setType(e.target.value)}><option value="">{ar ? 'كل الأنواع' : 'All types'}</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{ar ? 'كل الحالات' : 'All statuses'}</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, ar)}</option>)}</select>
          <div className="flex gap-2">
            <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid place-items-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">{ar ? 'لا توجد نتائج' : 'No results'}</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-3xl border border-border/60">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-mist text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-start p-3 font-heading">{ar ? 'العميل' : 'Customer'}</th>
                  <th className="text-start p-3 font-heading">{ar ? 'المكافأة' : 'Reward'}</th>
                  <th className="text-start p-3 font-heading">{ar ? 'الكود/المنتج' : 'Code / Product'}</th>
                  <th className="text-start p-3 font-heading">{ar ? 'التاريخ' : 'Date'}</th>
                  <th className="text-start p-3 font-heading">{ar ? 'الحالة' : 'Status'}</th>
                  <th className="text-start p-3 font-heading">{ar ? 'الطلب' : 'Order'}</th>
                  <th className="text-start p-3 font-heading">{ar ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const RIcon = Icon(s);
                  return (
                    <tr key={s.id} className="border-t border-border/40">
                      <td className="p-3">
                        <p className="font-heading font-bold">{s.customer_name || '—'}</p>
                        {s.customer_phone && <a href={`tel:${s.customer_phone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-cosmic"><Phone className="w-3 h-3" /> {s.customer_phone}</a>}
                        {s.user_email && <a href={`mailto:${s.user_email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-cosmic"><Mail className="w-3 h-3" /> <span className="truncate max-w-[140px]">{s.user_email}</span></a>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <RIcon className="w-4 h-4 text-cosmic shrink-0" />
                          <div><p className="font-heading font-bold">{spinRewardName(s, lang)}</p><p className="text-xs text-muted-foreground">{s.reward_type}{s.points_awarded ? ` · +${s.points_awarded}` : ''}</p></div>
                        </div>
                      </td>
                      <td className="p-3">
                        {s.discount_code ? <span className="font-mono text-xs">{s.discount_code}</span> : s.product_name ? <span className="text-xs">{spinProductName(s, lang)}</span> : '—'}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(s.created_date).toLocaleDateString(ar ? 'ar' : 'en')}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-heading font-bold ${statusCls(statusOf(s))}`}>{statusLabel(statusOf(s), ar)}</span></td>
                      <td className="p-3">{s.redeemed_order_id ? <Link to={`/orders-admin/${s.redeemed_order_id}`} className="text-cosmic font-bold text-xs">#{String(s.redeemed_order_id).slice(-6).toUpperCase()}</Link> : '—'}</td>
                      <td className="p-3">
                        {statusOf(s) === 'unused' && s.fulfillment === 'manual' && (
                          <button onClick={() => setSpinStatus(s, 'used')} className="h-8 px-3 rounded-full bg-emerald-600 text-white text-xs font-heading font-bold">{ar ? 'تسليم' : 'Mark used'}</button>
                        )}
                        {statusOf(s) === 'unused' && (
                          <button onClick={() => setSpinStatus(s, 'expired')} className="ms-1 h-8 px-3 rounded-full bg-amber-100 text-amber-700 text-xs font-heading font-bold">{ar ? 'إنهاء' : 'Expire'}</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}