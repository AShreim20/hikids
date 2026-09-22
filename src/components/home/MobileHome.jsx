import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, MessageCircle, Award, RotateCw } from 'lucide-react';
import { Image } from '@/components/ui/image';
import HeroCarousel from '@/components/HeroCarousel';
import Recommendations from '@/components/Recommendations';
import Newsletter from '@/components/Newsletter';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { useSiteContent } from '@/context/SiteContentContext';
import { useAuth } from '@/lib/AuthContext';
import { AGE_OPTIONS } from '@/lib/ages';
import { categoryName } from '@/lib/bilingual';
import { getLoyaltyBalance } from '@/lib/loyaltyFunctions';
import { useAvailableSpins } from '@/lib/useAvailableSpins';
import { setChatOpen } from '@/lib/chatOpenStore';

// Mobile (<768px) homepage: Hero, shop by age, categories, gift assistant,
// one product section (max 6), compact rewards strip. Everything reuses the
// existing data sources/routes; nothing here changes desktop or tablet.
const strip = (s) => (s || '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();

function SectionTitle({ children }) {
  return <h2 className="px-4 mb-2 font-heading font-extrabold text-lg">{children}</h2>;
}

function AgeChips() {
  const { t } = useLanguage();
  return (
    <section className="mb-5">
      <SectionTitle>{t('mhome.shopByAge')}</SectionTitle>
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {AGE_OPTIONS.map((a) => (
          <Link key={a.id} to={`/shop?age=${a.id}`} className="squish shrink-0 h-11 px-4 inline-flex items-center rounded-full bg-mist border border-border/60 font-heading font-bold text-sm whitespace-nowrap">
            {t(`age.${a.id}`)}
          </Link>
        ))}
      </div>
    </section>
  );
}

function CategoryScroller() {
  const { t, lang } = useLanguage();
  const { categories } = useCategories();
  const { content } = useSiteContent();
  // Max 6, same rule as the desktop "World of Play": the admin's picks if any,
  // otherwise the first active categories by sort order.
  const list = useMemo(() => {
    const active = categories.filter((c) => c.active !== false);
    const picked = (content('world_of_play', { category_ids: [] }).category_ids || [])
      .map((id) => active.find((c) => c.id === id)).filter(Boolean);
    const base = picked.length ? picked : [...active].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return base.slice(0, 6);
  }, [categories, content]);
  if (!list.length) return null;
  return (
    <section className="mb-5">
      <SectionTitle>{t('mhome.categories')}</SectionTitle>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {list.map((c) => {
          const name = strip(categoryName(c, lang));
          return (
            <Link key={c.id} to={`/shop?category=${encodeURIComponent(c.name)}`} className="squish shrink-0 w-20 text-center" aria-label={name}>
              <div className="relative mx-auto w-20 h-20 rounded-2xl overflow-hidden bg-mist border border-border/60 grid place-items-center">
                {c.image_url ? <Image src={c.image_url} alt="" fittingType="fill" className="absolute inset-0 w-full h-full object-cover" /> : <Sparkles className="w-6 h-6 text-cosmic" />}
              </div>
              <p className="mt-1.5 text-xs font-heading font-bold line-clamp-2 leading-tight">{name}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function AssistantCard() {
  const { t } = useLanguage();
  return (
    <section className="px-4 mb-5">
      <button type="button" onClick={() => setChatOpen(true)} className="squish w-full flex items-center gap-3 rounded-3xl bg-cosmic p-4 text-start text-white">
        <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white/20 shrink-0"><MessageCircle className="w-6 h-6" /></span>
        <span className="flex-1 min-w-0">
          <span className="block font-heading font-extrabold text-base">{t('mhome.assistantTitle')}</span>
          <span className="block text-xs text-white/80 mt-0.5">{t('mhome.assistantDesc')}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white text-cosmic px-3 py-1.5 text-xs font-heading font-bold">{t('mhome.assistantCta')}</span>
      </button>
    </section>
  );
}

// Available points + available spins only (pending rewards are never shown).
function RewardsStrip() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const spins = useAvailableSpins();
  const [points, setPoints] = useState(null);
  useEffect(() => {
    if (!user) { setPoints(null); return; }
    getLoyaltyBalance().then((r) => { if (r?.success) setPoints(Number(r.balance) || 0); }).catch(() => {});
  }, [user]);
  if (!user || points === null) return null;
  return (
    <section className="px-4 mb-5">
      <Link to="/wheel-rewards" className="squish flex items-center justify-between gap-3 rounded-2xl bg-mist border border-border/60 px-4 py-3">
        <span className="inline-flex items-center gap-2 font-heading font-bold text-sm"><Award className="w-5 h-5 text-cosmic" /> {points} {t('mhome.points')}</span>
        <span className="inline-flex items-center gap-2 font-heading font-bold text-sm"><RotateCw className="w-5 h-5 text-accent" /> {spins ?? 0} {t('mhome.spins')}</span>
      </Link>
    </section>
  );
}

export default function MobileHome() {
  return (
    <>
      <HeroCarousel compact />
      <AgeChips />
      <CategoryScroller />
      <AssistantCard />
      <Recommendations limit={6} alwaysShowBrowse />
      <RewardsStrip />
      <Newsletter />
    </>
  );
}
