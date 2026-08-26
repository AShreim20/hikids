import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Loader2, Check, X, Camera, Star, Settings as SettingsIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { unwrap } from '@/lib/invoke';
import { getSetting, setSetting } from '@/lib/storeSettings';

const REWARD_KEY = 'photo_review_reward_points';
const DEFAULT_POINTS = 50;

// Admin review of customer photo reviews. Approving publishes the photo and
// credits the configured loyalty points exactly once; rejecting hides it and
// grants nothing. The reward points amount is configurable here.
export default function PhotoReviews() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [products, setProducts] = useState([]);
  const [rewardPoints, setRewardPoints] = useState(DEFAULT_POINTS);
  const [pointsInput, setPointsInput] = useState(String(DEFAULT_POINTS));
  const [savingPoints, setSavingPoints] = useState(false);
  const [busy, setBusy] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [rows, pts] = await Promise.all([
        base44.entities.Review.filter({ status: 'pending' }, '-created_date', 200),
        getSetting(REWARD_KEY, DEFAULT_POINTS),
      ]);
      const list = (rows || []).filter((r) => !!r.photo_url);
      setPending(list);
      setRewardPoints(Number(pts) || 0);
      setPointsInput(String(Number(pts) || 0));
      const ids = [...new Set(list.map((r) => r.product_id))];
      if (ids.length) {
        const all = await base44.entities.Product.list('-updated_date', 200);
        setProducts((all || []).filter((p) => ids.includes(p.id)));
      } else {
        setProducts([]);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (user?.role === 'admin' || (user && (user.permissions || []).length)) load(); else setLoading(false); }, [user]);

  const canReview = user && (user.role === 'admin' || (user.permissions || []).includes('loyalty.add'));

  if (!canReview) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{ar ? 'محمي' : 'Access denied'}</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{ar ? 'العودة' : 'Back'}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const review = async (r, action) => {
    setBusy((b) => ({ ...b, [r.id]: true }));
    try {
      const res = unwrap(await base44.functions.invoke('reviewPhoto', { review_id: r.id, action }));
      toast({
        title: res.success ? (ar ? 'تم' : 'Done') : res.message,
        description: action === 'approve' && res.success ? `+${res.points} ${ar ? 'نقطة' : 'pts'}` : undefined,
        variant: res.success ? 'default' : 'destructive',
      });
      load();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setBusy((b) => ({ ...b, [r.id]: false }));
    }
  };

  const savePoints = async () => {
    setSavingPoints(true);
    const ok = await setSetting(REWARD_KEY, Number(pointsInput) || 0, 'Photo review reward points');
    setSavingPoints(false);
    toast({ title: ok ? (ar ? 'تم الحفظ' : 'Saved') : (ar ? 'حدث خطأ' : 'Error'), variant: ok ? 'default' : 'destructive' });
    if (ok) setRewardPoints(Number(pointsInput) || 0);
  };

  const productName = (id) => products.find((p) => p.id === id)?.name || '';

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/" className="text-sm text-muted-foreground">← {ar ? 'العودة' : 'Back'}</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10 text-cosmic"><Camera className="w-6 h-6" /></div>
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'مراجعات الصور' : 'Photo Reviews'}</h1>
            <p className="text-muted-foreground text-sm">{ar ? 'راجع صور العملاء ومنح المكافآت' : 'Approve customer photos and grant rewards'}</p>
          </div>
        </div>

        {/* Reward points setting */}
        <div className="mt-6 flex items-center gap-3 rounded-3xl bg-card border border-border/60 p-5 max-w-md">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-mist text-cosmic shrink-0"><SettingsIcon className="w-5 h-5" /></div>
          <div className="flex-1">
            <p className="font-heading font-bold text-sm">{ar ? 'نقاط مكافأة صورة المراجعة' : 'Photo review reward points'}</p>
            <p className="text-xs text-muted-foreground">{ar ? 'تُمنح مرة واحدة عند الموافقة' : 'Granted once on approval'}</p>
          </div>
          <input
            type="number"
            min="0"
            value={pointsInput}
            onChange={(e) => setPointsInput(e.target.value)}
            className="w-24 h-11 px-3 rounded-2xl bg-mist border border-border text-center font-heading font-bold focus:outline-none focus:ring-2 focus:ring-cosmic/40"
          />
          <button
            onClick={savePoints}
            disabled={savingPoints}
            className="squish h-11 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-sm disabled:opacity-60"
          >
            {savingPoints ? <Loader2 className="w-4 h-4 animate-spin" /> : ar ? 'حفظ' : 'Save'}
          </button>
        </div>

        {/* Pending list */}
        <h2 className="mt-8 font-heading font-extrabold text-xl">
          {ar ? 'بانتظار المراجعة' : 'Pending review'} ({pending.length})
        </h2>
        {loading ? (
          <div className="mt-6 grid place-items-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : pending.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-mist p-12 text-center">
            <Check className="w-8 h-8 mx-auto text-emerald-600" />
            <p className="mt-3 font-heading font-bold text-lg">{ar ? 'لا توجد صور للمراجعة' : 'No photos pending review'}</p>
          </div>
        ) : (
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((r) => (
              <div key={r.id} className="rounded-3xl bg-card border border-border/60 p-3 flex flex-col">
                <div className="aspect-square rounded-2xl overflow-hidden bg-mist">
                  <Image src={r.photo_url} alt="" fittingType="fill" className="w-full h-full" />
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < (r.rating || 0) ? 'fill-accent text-accent' : 'text-border'}`} />
                  ))}
                </div>
                {productName(r.product_id) && (
                  <Link to={`/product/${r.product_id}`} className="mt-1 text-sm font-heading font-bold hover:text-cosmic truncate">
                    {productName(r.product_id)}
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">{r.user_email}</p>
                <p className="text-sm text-foreground/80 mt-1 line-clamp-3">{r.comment}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => review(r, 'approve')}
                    disabled={busy[r.id]}
                    className="flex-1 h-10 rounded-full bg-emerald-600 text-white font-heading font-bold text-sm inline-flex items-center justify-center gap-1 disabled:opacity-60"
                  >
                    {busy[r.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {ar ? 'موافقة' : 'Approve'}
                  </button>
                  <button
                    onClick={() => review(r, 'reject')}
                    disabled={busy[r.id]}
                    className="flex-1 h-10 rounded-full bg-destructive/10 text-destructive font-heading font-bold text-sm inline-flex items-center justify-center gap-1 disabled:opacity-60"
                  >
                    <X className="w-4 h-4" /> {ar ? 'رفض' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}