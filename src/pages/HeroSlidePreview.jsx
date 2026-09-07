import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, Lock } from 'lucide-react';
import { db } from '@/api/entities';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { loadPreviewSnapshot } from '@/lib/sessionDraft';
import HeroSlideMedia from '@/components/HeroSlideMedia';
import HeroSlideContent from '@/components/HeroSlideContent';

const isMobileViewportNow = () => typeof window !== 'undefined' && window.innerWidth < 768;

// Admin-only single-slide preview — reuses the exact same HeroSlideMedia /
// HeroSlideContent the live carousel renders (not a mockup), from the
// in-memory form snapshot the editor just wrote to sessionStorage (see
// HeroSlideForm's preview()), so unsaved edits show up here even though
// nothing was saved. Never auto-advances — there's nothing to advance to —
// and works identically for an Active, Inactive, future-scheduled, or
// expired slide, since it deliberately does not apply the public
// active/schedule visibility rule at all.
export default function HeroSlidePreview() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const [slide, setSlide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const snap = loadPreviewSnapshot(id, 'hero_slide');
    if (snap) {
      setSlide(snap);
      setLoading(false);
      return;
    }
    if (id && id !== 'new') {
      db.HeroSlide.get(id).then(setSlide).catch(() => setSlide(null)).finally(() => setLoading(false));
    } else {
      setSlide(null);
      setLoading(false);
    }
  }, [id]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('admin.deniedDesc')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-cosmic text-white text-sm font-heading font-bold text-center py-2 px-4">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="w-4 h-4" /> {ar ? 'وضع المعاينة — لا تظهر هذه الشريحة للعملاء' : 'Preview mode — this slide is not visible to customers'}
        </span>
      </div>
      <Navbar />
      {loading ? (
        <div className="px-2 sm:px-3 md:px-4 mt-3 sm:mt-4 md:mt-6">
          <div className="h-[380px] sm:h-[440px] md:h-[clamp(460px,58vh,620px)] rounded-[1.75rem] sm:rounded-[2rem] bg-mist animate-pulse" />
        </div>
      ) : !slide ? (
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-2xl">{ar ? 'لا يوجد شيء للمعاينة بعد' : 'Nothing to preview yet'}</h1>
          <p className="mt-3 text-muted-foreground">{ar ? 'احفظ الشريحة أو أعد فتح المعاينة من المحرر.' : 'Save the slide, or reopen Preview from the editor.'}</p>
        </div>
      ) : (
        <div className="px-2 sm:px-3 md:px-4 mt-3 sm:mt-4 md:mt-6">
          <div className="relative h-[380px] sm:h-[440px] md:h-[clamp(460px,58vh,620px)] rounded-[1.75rem] sm:rounded-[2rem] overflow-hidden bg-mist">
            <HeroSlideMedia slide={slide} isMobileViewport={isMobileViewportNow()} eager />
            <HeroSlideContent slide={slide} exploreCtaLabel={t('hero.exploreCta')} />
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
