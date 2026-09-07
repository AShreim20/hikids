import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, GraduationCap, Puzzle, Blocks, Palette, Car, Baby,
  Users, Trophy, Cpu, Waves, TreePine, Gift, Drama, Shapes,
} from 'lucide-react';
import { Image } from '@/components/ui/image';
import { categoryName, categoryDescription } from '@/lib/bilingual';

// Deterministic keyword -> icon mapping for the fallback card (there is no
// per-category icon field in the data model, and this task isn't adding
// one — see item 37). Same category always resolves to the same icon.
const ICON_RULES = [
  { icon: Puzzle, kws: ['ذكاء', 'ألغاز', 'puzzle', 'brain'] },
  { icon: Blocks, kws: ['تركيب', 'بناء', 'build', 'construction', 'block'] },
  { icon: Palette, kws: ['فن', 'إبداع', 'رسم', 'art', 'craft'] },
  { icon: Car, kws: ['سيارات', 'مركبات', 'car', 'vehicle'] },
  { icon: Baby, kws: ['دمى', 'دمية', 'طفل', 'doll', 'figure', 'baby', 'toddler'] },
  { icon: GraduationCap, kws: ['تعليم', 'education', 'learn'] },
  { icon: Users, kws: ['جماع', 'عائل', 'family', 'group'] },
  { icon: Trophy, kws: ['رياض', 'حرك', 'sport', 'active'] },
  { icon: Cpu, kws: ['إلكترون', 'تفاعل', 'electronic', 'interactive'] },
  { icon: Waves, kws: ['ماء', 'رمل', 'water', 'sand'] },
  { icon: TreePine, kws: ['خارج', 'outdoor'] },
  { icon: Gift, kws: ['هد', 'gift'] },
  { icon: Drama, kws: ['تمثيل', 'خيال', 'pretend', 'imagin'] },
];

function fallbackIconFor(category) {
  const hay = `${category?.name || ''} ${category?.name_en || ''}`.toLowerCase();
  for (const { icon, kws } of ICON_RULES) {
    if (kws.some((k) => hay.includes(k))) return icon;
  }
  return Shapes;
}

// Some category names carry a leading emoji baked in from an earlier
// seed/admin entry (e.g. "🎓 ألعاب تعليمية"). Every card now shows a proper
// icon, so strip a leading emoji from the *display* text only — the stored
// category name itself is never modified.
function stripLeadingEmoji(text) {
  if (!text) return text;
  return text.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();
}

// Deterministic, on-brand placeholder used whenever a category has no image
// (or its image fails to load) — never a random product photo, never a
// generic "broken image" glyph.
function CategoryFallback({ Icon }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-cosmic via-cosmic/85 to-accent/80">
      <div aria-hidden className="absolute -top-8 -start-8 w-28 h-28 rounded-full bg-white/15 blur-2xl" />
      <div aria-hidden className="absolute bottom-4 end-6 w-24 h-24 rounded-full bg-accent/40 blur-xl" />
      <div aria-hidden className="absolute top-6 end-10 w-2.5 h-2.5 rounded-full bg-white/70" />
      <div aria-hidden className="absolute top-10 end-16 w-1.5 h-1.5 rounded-full bg-white/50" />
      <div aria-hidden className="absolute bottom-10 start-8 w-2 h-2 rounded-full bg-white/60" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid place-items-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
          <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

// One category tile for the World of Play grid. The whole card is a single
// <Link> (proper accessible link semantics, no nested/conflicting links),
// navigating to the existing category-filtered Product Listing.
export default function CategoryCard({ category, lang, index }) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgElRef = useRef(null);

  // `Image` (components/ui/image.jsx) swallows load failures internally and
  // swaps to its own generic placeholder — it doesn't expose an onError prop
  // we can hook. Watching the underlying <img> node directly lets a broken
  // category image fall back to this card's own on-brand design instead.
  useEffect(() => {
    if (!category.image_url) return undefined;
    const el = imgElRef.current;
    if (!el) return undefined;
    const onError = () => setImgFailed(true);
    el.addEventListener('error', onError);
    return () => el.removeEventListener('error', onError);
  }, [category.image_url]);

  const name = stripLeadingEmoji(categoryName(category, lang));
  const desc = stripLeadingEmoji(categoryDescription(category, lang));
  const hasImage = !!category.image_url && !imgFailed;
  const FallbackIcon = fallbackIconFor(category);

  return (
    <Link
      to={`/shop?category=${encodeURIComponent(category.name)}`}
      aria-label={name}
      className="group relative overflow-hidden rounded-3xl bg-mist aspect-[4/3] sm:aspect-[16/11] flex flex-col justify-end squish float-in transition-transform motion-reduce:transition-none hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {hasImage ? (
        <Image
          ref={imgElRef}
          src={category.image_url}
          alt={name}
          fittingType="fill"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out motion-reduce:transition-none group-hover:scale-[1.05]"
        />
      ) : (
        <CategoryFallback Icon={FallbackIcon} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="relative p-4 sm:p-6 md:p-7 text-white">
        <h3 className="font-heading font-bold text-base sm:text-xl md:text-2xl leading-tight truncate">{name}</h3>
        {desc && <p className="text-xs sm:text-sm text-white/80 mt-1 line-clamp-2">{desc}</p>}
        <ArrowRight
          className="w-5 h-5 mt-2 sm:mt-3 text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180 transition-all motion-reduce:transition-none"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
