import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, Ticket, Package, Plus, Check, ShoppingBag, ArrowRight } from 'lucide-react';
import { db } from '@/api/entities';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useCart } from '@/context/CartContext';
import { spinRewardName, spinProductName } from '@/lib/bilingual';
import RewardsAuthGate from '@/components/RewardsAuthGate';

const expired = (s) => s.expires_at && new Date(s.expires_at) < new Date();
const statusOf = (s) => {
  if (s.status === 'used') return 'used';
  if (s.status === 'unavailable') return 'unavailable';
  if (s.status === 'expired' || expired(s)) return 'expired';
  return 'unused';
};
const statusStyle = (st, ar) => {
  const label = {
    used: ar ? 'مستخدم' : 'Used',
    unused: ar ? 'غير مستخدم' : 'Unused',
    expired: ar ? 'منتهي' : 'Expired',
    unavailable: ar ? 'غير متاح' : 'Unavailable',
  }[st];
  const cls = {
    used: 'bg-emerald-100 text-emerald-700',
    unused: 'bg-cosmic/10 text-cosmic',
    expired: 'bg-amber-100 text-amber-700',
    unavailable: 'bg-destructive/10 text-destructive',
  }[st];
  return { label, cls };
};

export default function MyWheelRewards() {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { user } = useAuth();
  const { items, addWheelReward } = useCart();
  const [loading, setLoading] = useState(true);
  const [spins, setSpins] = useState([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    db.WheelSpin.filter({ user_email: user.email })
      .then((r) => setSpins((r || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))))
      .catch(() => setSpins([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return <RewardsAuthGate title={ar ? 'مكافآتي' : 'My Wheel Rewards'} />;

  const inCart = (spinId) => items.some((i) => i.lineId === `wheel::${spinId}`);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={ar ? 'مكافآتي' : 'My Wheel Rewards'} />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-accent/10 text-accent"><Sparkles className="w-6 h-6" /></div>
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'مكافآت صندوق المفاجآت' : 'My Wheel Rewards'}</h1>
            <p className="text-muted-foreground text-sm">{ar ? 'كل ما ربحته من العجلة وحالته' : 'Everything you won from the wheel and its status'}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-3 text-sm">
          <Link to="/wheel" className="text-cosmic font-heading font-bold inline-flex items-center gap-1">{ar ? 'أدر العجلة' : 'Spin the wheel'} <ArrowRight className="w-4 h-4 rtl:rotate-180" /></Link>
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : spins.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{ar ? 'لا توجد مكافآت بعد' : 'No rewards yet'}</p>
            <Link to="/wheel" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{ar ? 'أدر العجلة' : 'Spin the wheel'}</Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {spins.map((s) => {
              const st = statusOf(s);
              const badge = statusStyle(st, ar);
              const canAddToCart = st === 'unused' && s.reward_type === 'product' && s.product_id;
              return (
                <div key={s.id} className="rounded-3xl bg-card border border-border/60 p-4 flex gap-4">
                  <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10 text-cosmic shrink-0">
                    {s.reward_type === 'discount_percent' || s.reward_type === 'discount_fixed' || s.reward_type === 'credit' ? <Ticket className="w-6 h-6" /> : s.reward_type === 'product' ? <Package className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-heading font-bold truncate">{spinRewardName(s, lang)}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-heading font-bold ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{new Date(s.created_date).toLocaleDateString(ar ? 'ar' : 'en')}</span>
                      {s.points_awarded > 0 && <span className="text-cosmic font-bold">+{s.points_awarded} {ar ? 'نقطة' : 'pts'}</span>}
                      {s.discount_code && <span className="font-mono inline-flex items-center gap-1"><Ticket className="w-3 h-3" /> {s.discount_code}</span>}
                      {s.expires_at && <span>{ar ? 'ينتهي' : 'Expires'}: {new Date(s.expires_at).toLocaleDateString(ar ? 'ar' : 'en')}</span>}
                      {s.redeemed_order_id && st === 'used' && <Link to="/orders" className="text-cosmic font-bold">{ar ? 'الطلب' : 'Order'} #{String(s.redeemed_order_id).slice(-6).toUpperCase()}</Link>}
                    </div>
                    {s.product_id && s.product_image && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-mist shrink-0"><Image src={s.product_image} alt="" fittingType="fill" className="w-full h-full" /></div>
                        <span className="text-xs text-muted-foreground truncate">{spinProductName(s, lang)}</span>
                      </div>
                    )}
                    {canAddToCart && (
                      inCart(s.id) ? (
                        <Link to="/cart" className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-emerald-600 text-white text-xs font-heading font-bold"><Check className="w-4 h-4" /> {ar ? 'في السلة' : 'In cart'} <ShoppingBag className="w-3.5 h-3.5" /></Link>
                      ) : (
                        <button onClick={() => addWheelReward({ id: s.product_id, name: s.product_name, name_en: s.product_name_en, image_url: s.product_image }, s.id, s.product_price)} className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-cosmic text-white text-xs font-heading font-bold"><Plus className="w-4 h-4" /> {ar ? 'أضف إلى السلة مجانًا' : 'Add to cart (free)'}</button>
                      )
                    )}
                    {s.fulfillment === 'manual' && s.reward_type !== 'product' && st === 'unused' && (
                      <p className="mt-2 text-xs text-muted-foreground">{ar ? 'سيتم تواصل المتجر معك لاستلام المكافأة' : 'The store will contact you to fulfill this reward'}</p>
                    )}
                  </div>
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