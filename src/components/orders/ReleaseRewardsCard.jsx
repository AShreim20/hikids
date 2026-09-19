import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { orderRewardsPreview, adminReleaseRewardsNow } from '@/lib/loyaltyFunctions';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from '@/components/ui/use-toast';

// تحرير المكافآت الآن / Release Rewards Now -- the admin only confirms; the
// server calculates Points/Spins and records the early release.
export default function ReleaseRewardsCard({ order }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => orderRewardsPreview(order.id).then(setInfo).catch(() => setInfo(null));
  useEffect(() => { load(); }, [order.id, order.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info?.success || !info.applicable) return null;
  const date = (d) => new Date(d).toLocaleDateString(ar ? 'ar-u-nu-latn' : 'en');

  const release = async () => {
    if (!window.confirm(ar ? `تحرير ${info.points} نقطة و${info.spins} دورة الآن؟` : `Release ${info.points} points and ${info.spins} spins now?`)) return;
    setBusy(true);
    try {
      const res = await adminReleaseRewardsNow(order.id);
      toast({ title: res?.success ? (ar ? 'تم تحرير المكافآت' : 'Rewards released') : (ar ? 'تعذّر التحرير' : 'Could not release'), variant: res?.success ? undefined : 'destructive' });
    } catch {
      toast({ title: ar ? 'تعذّر التحرير' : 'Could not release', variant: 'destructive' });
    } finally {
      setBusy(false);
      load();
    }
  };

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl flex items-center gap-2"><Gift className="w-5 h-5" /> {ar ? 'مكافآت الشراء' : 'Purchase rewards'}</h2>
      <p className="mt-3 text-sm">{info.points} {ar ? 'نقطة' : 'pts'} · {info.spins} {ar ? 'دورة' : 'spins'}</p>
      {info.released_at ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {info.released_early ? (ar ? 'تم التحرير مبكراً بواسطة المسؤول' : 'Released Early by Admin') : (ar ? 'تم التحرير' : 'Released')} · {date(info.released_at)}
          {info.review_needed ? (ar ? ' · بحاجة لمراجعة المسؤول' : ' · needs admin review') : ''}
        </p>
      ) : (
        <>
          {info.release_at && <p className="mt-1 text-xs text-muted-foreground">{ar ? 'موعد التحرير العادي' : 'Normal release'}: {date(info.release_at)}</p>}
          {info.blocked_reason === 'return_hold' && <p className="mt-1 text-xs text-accent">بانتظار اكتمال طلب الإرجاع</p>}
          {info.can_release && (
            <button onClick={release} disabled={busy} className="mt-3 h-10 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-sm disabled:opacity-50">
              {ar ? 'تحرير المكافآت الآن' : 'Release Rewards Now'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
