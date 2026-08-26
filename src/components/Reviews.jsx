import React, { useEffect, useRef, useState } from 'react';
import { Star, MessageSquare, Camera, Loader2, Image as ImageIcon, Clock, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { unwrap } from '@/lib/invoke';

const STATUS = {
  pending: { en: 'Pending review', ar: 'قيد المراجعة', cls: 'bg-mist text-muted-foreground', icon: Clock },
  approved: { en: 'Approved', ar: 'تمت الموافقة', cls: 'bg-emerald-100 text-emerald-700', icon: Check },
  rejected: { en: 'Rejected', ar: 'مرفوض', cls: 'bg-destructive/10 text-destructive', icon: X },
};

// A photo review is only public once an admin approves it. Text reviews (no
// photo) have no approval step and stay visible as before.
const isPublished = (r) => !r.photo_url || r.status === 'approved';

export default function Reviews({ productId }) {
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    setLoading(true);
    base44.entities.Review.filter({ product_id: productId }, '-created_date', 50)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (productId) load();
  }, [productId]);

  const published = reviews.filter(isPublished);
  const myPhotoReviews = user
    ? reviews.filter((r) => r.photo_url && r.user_email === user.email)
    : [];
  const avg = published.length
    ? published.reduce((s, r) => s + (r.rating || 0), 0) / published.length
    : 0;

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPhotoPreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      toast({ title: t('reviews.pickRating'), variant: 'destructive' });
      return;
    }

    // A photo review must go through the approval flow (and requires a logged-in
    // customer so the loyalty reward can be credited on approval).
    if (photo) {
      if (!user) {
        toast({ title: ar ? 'سجّل الدخول لإرسال صورة' : 'Sign in to submit a photo', variant: 'destructive' });
        return;
      }
      setSubmitting(true);
      try {
        const up = await base44.integrations.Core.UploadFile({ file: photo });
        const res = unwrap(
          await base44.functions.invoke('submitPhotoReview', {
            product_id: productId,
            rating,
            name: name.trim() || user.full_name || user.email,
            comment: comment.trim(),
            file_url: up.file_url,
          })
        );
        if (!res.success) {
          toast({ title: res.message || t('reviews.error'), variant: 'destructive' });
        } else {
          toast({ title: ar ? 'تم الإرسال للمراجعة' : 'Submitted for review' });
          setName(''); setRating(0); setComment(''); clearPhoto();
          load();
        }
      } catch {
        toast({ title: t('reviews.error'), variant: 'destructive' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Text-only review — unchanged existing flow (no approval needed).
    setSubmitting(true);
    try {
      await base44.entities.Review.create({
        product_id: productId,
        rating,
        name: name.trim() || t('reviews.anonymous'),
        comment: comment.trim(),
      });
      setName(''); setRating(0); setComment('');
      load();
      toast({ title: t('reviews.thanks') });
    } catch {
      toast({ title: t('reviews.error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            {t('reviews.label')}
          </p>
          <h2 className="mt-2 font-heading font-extrabold text-3xl md:text-4xl">
            {t('reviews.title')}
          </h2>
        </div>
        {published.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${i < Math.round(avg) ? 'fill-accent text-accent' : 'text-border'}`}
                />
              ))}
            </div>
            <span className="font-heading font-bold">
              {avg.toFixed(1)} · {published.length}{' '}
              {published.length === 1 ? t('reviews.reviewSingular') : t('reviews.reviewPlural')}
            </span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-3xl bg-mist animate-pulse" />
            ))
          ) : published.length === 0 ? (
            <div className="rounded-3xl bg-mist p-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="mt-3 font-heading font-bold text-lg">{t('reviews.emptyTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('reviews.emptyDesc')}</p>
            </div>
          ) : (
            published.map((r) => (
              <div key={r.id} className="rounded-3xl bg-card border border-border/60 p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid place-items-center w-10 h-10 rounded-full bg-cosmic/15 text-cosmic font-heading font-bold">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-heading font-bold">{r.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i < (r.rating || 0) ? 'fill-accent text-accent' : 'text-border'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_date).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && <p className="mt-4 text-muted-foreground leading-relaxed">{r.comment}</p>}
                {r.photo_url && (
                  <div className="mt-4 rounded-2xl overflow-hidden bg-mist w-full max-w-xs">
                    <Image src={r.photo_url} alt="" fittingType="fill" className="w-full h-48" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* The customer's own photo reviews and their approval status */}
          {myPhotoReviews.length > 0 && (
            <div className="rounded-3xl bg-mist/60 border border-border/60 p-5">
              <h3 className="font-heading font-bold text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cosmic" />
                {ar ? 'صوري المُرسلة' : 'My photo reviews'}
              </h3>
              <div className="mt-3 space-y-2">
                {myPhotoReviews.map((r) => {
                  const st = STATUS[r.status] || STATUS.pending;
                  const StIcon = st.icon;
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-2 pr-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-mist shrink-0">
                        <Image src={r.photo_url} alt="" fittingType="fill" className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-heading font-bold truncate">{r.comment || (ar ? 'مراجعة بالصورة' : 'Photo review')}</p>
                        <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-heading font-bold ${st.cls}`}>
                          <StIcon className="w-3 h-3" /> {ar ? st.ar : st.en}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="lg:sticky lg:top-28 h-fit rounded-3xl bg-mist p-6 md:p-8">
          <h3 className="font-heading font-extrabold text-xl">{t('reviews.leaveTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('reviews.leaveDesc')}</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <span className="text-sm font-medium text-foreground/80">{t('reviews.yourRating')}</span>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const val = i + 1;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(val)}
                      onMouseEnter={() => setHover(val)}
                      onMouseLeave={() => setHover(0)}
                      className="p-1"
                      aria-label={`${val} star`}
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          (hover || rating) >= val ? 'fill-accent text-accent' : 'text-border'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-foreground/80">{t('reviews.name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('reviews.namePlaceholder')}
                className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground/80">{t('reviews.review')}</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('reviews.reviewPlaceholder')}
                rows={4}
                className="mt-1.5 w-full p-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic resize-none"
              />
            </label>

            {/* Optional photo — earns loyalty points once approved by the store */}
            <div>
              <span className="text-sm font-medium text-foreground/80">
                {ar ? 'صورة طفلك بالمنتج (اختياري)' : 'Photo of your child with the product (optional)'}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ar ? 'يخضع للمراجعة ويُمنح مكافأة نقاط عند الموافقة' : 'Reviewed by the store; earns loyalty points on approval'}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={pickPhoto}
                className="hidden"
              />
              {!photoPreview ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 w-full h-28 rounded-2xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-cosmic/50 transition-colors"
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-sm font-heading font-bold">{ar ? 'رفع صورة' : 'Upload photo'}</span>
                </button>
              ) : (
                <div className="mt-2 relative rounded-2xl overflow-hidden bg-background border border-border">
                  <Image src={photoPreview} alt="" fittingType="fill" className="w-full h-32" />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full bg-black/55 text-white"
                    aria-label="Remove photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="squish w-full py-3.5 rounded-full bg-cosmic text-white font-heading font-bold hover:bg-primary transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? t('reviews.submitting') : t('reviews.submit')}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}