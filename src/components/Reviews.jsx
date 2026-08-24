import React, { useEffect, useState } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';

export default function Reviews({ productId }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
    : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      toast({ title: t('reviews.pickRating'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await base44.entities.Review.create({
        product_id: productId,
        rating,
        name: name.trim() || t('reviews.anonymous'),
        comment: comment.trim(),
      });
      setName('');
      setRating(0);
      setComment('');
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
        {reviews.length > 0 && (
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
              {avg.toFixed(1)} · {reviews.length}{' '}
              {reviews.length === 1 ? t('reviews.reviewSingular') : t('reviews.reviewPlural')}
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
          ) : reviews.length === 0 ? (
            <div className="rounded-3xl bg-mist p-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="mt-3 font-heading font-bold text-lg">{t('reviews.emptyTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('reviews.emptyDesc')}</p>
            </div>
          ) : (
            reviews.map((r) => (
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
                <p className="mt-4 text-muted-foreground leading-relaxed">{r.comment}</p>
              </div>
            ))
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
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('reviews.reviewPlaceholder')}
                rows={4}
                className="mt-1.5 w-full p-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic resize-none"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="squish w-full py-3.5 rounded-full bg-cosmic text-white font-heading font-bold hover:bg-primary transition-colors disabled:opacity-60"
            >
              {submitting ? t('reviews.submitting') : t('reviews.submit')}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}