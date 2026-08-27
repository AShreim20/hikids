import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { AGE_OPTIONS } from '@/components/shop/ProductFilters';

// "Shop by Gender" header menu. Desktop: hover dropdown with Boys / Girls
// columns, each listing the shared age ranges. Mobile: tap to open the same
// panel. Selecting an age navigates to /shop with gender + age pre-applied.
const GENDERS = [
  { key: 'Boy', labelKey: 'gender.boys' },
  { key: 'Girl', labelKey: 'gender.girls' },
];

export default function ShopByGenderMenu({ mobile = false, onNavigate }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const groups = GENDERS.map((g) => ({
    ...g,
    ages: AGE_OPTIONS,
  }));

  const linkFor = (gender, ageId) => `/shop?gender=${gender}&age=${ageId}`;

  const Panel = (
    <div
      className={
        mobile
          ? 'absolute end-0 top-full z-50 min-w-[280px] rounded-2xl bg-[#5D3F85] border border-white/15 shadow-xl p-4'
          : 'min-w-[440px] rounded-2xl bg-[#5D3F85] border border-white/15 shadow-xl p-5'
      }
    >
      <div className={mobile ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-2 gap-8'}>
        {groups.map((g) => (
          <div key={g.key}>
            <p className={`font-heading font-bold text-white mb-2 ${mobile ? 'text-xs' : 'text-sm'}`}>
              {t(g.labelKey)}
            </p>
            <ul className="space-y-0.5">
              {g.ages.map((a) => (
                <li key={a.id}>
                  <Link
                    to={linkFor(g.key, a.id)}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className={`block rounded-lg text-white/80 hover:bg-white/10 hover:text-accent transition-colors ${
                      mobile ? 'px-2 py-1 text-xs whitespace-nowrap' : 'px-3 py-1.5 text-sm'
                    }`}
                  >
                    {t(`age.${a.id}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap"
        >
          {t('nav.shopByGender')} <ChevronDown className="w-4 h-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            {Panel}
          </>
        )}
      </div>
    );
  }

  // Desktop: hover. The pt-2 bridge keeps hover continuous across the gap
  // between the button and the visible card.
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap"
      >
        {t('nav.shopByGender')} <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute start-0 top-full z-50 pt-2">
          {Panel}
        </div>
      )}
    </div>
  );
}