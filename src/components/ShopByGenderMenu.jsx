import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { AGE_OPTIONS } from '@/lib/ages';
import { GENDER_MALE, GENDER_FEMALE } from '@/lib/gender';

// "Shop by Gender" header menu — two levels.
//   Level 1: Boys / Girls. The label itself is a link straight to /shop with
//            just that gender applied; a separate chevron affordance expands
//            level 2 without navigating.
//   Level 2: an "Ages" list, revealed on hover (desktop) or tap of the
//            chevron (mobile) of a gender. Selecting an age navigates to
//            /shop with gender + age pre-applied, reusing the existing
//            product filters (no duplicate age system).
const GENDERS = [
  { key: GENDER_MALE, labelKey: 'gender.boys' },
  { key: GENDER_FEMALE, labelKey: 'gender.girls' },
];

export default function ShopByGenderMenu({ mobile = false, onNavigate }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);   // desktop: gender whose ages are shown
  const [expanded, setExpanded] = useState(null); // mobile: opened gender accordion

  const linkFor = (gender, ageId) => `/shop?gender=${gender}&age=${ageId}`;
  const genderLinkFor = (gender) => `/shop?gender=${gender}`;
  const closeAll = () => {
    setOpen(false);
    setHovered(null);
    setExpanded(null);
    onNavigate?.();
  };

  const AgesList = ({ gender, itemClass }) => (
    <ul className="space-y-0.5">
      {AGE_OPTIONS.map((a) => (
        <li key={a.id}>
          <Link
            to={linkFor(gender, a.id)}
            onClick={closeAll}
            className={`block rounded-lg text-white hover:bg-white/15 hover:text-accent transition-colors ${itemClass}`}
          >
            {t(`age.${a.id}`)}
          </Link>
        </li>
      ))}
    </ul>
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
            <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setExpanded(null); }} />
            <div className="absolute start-0 top-full mt-2 z-[60] min-w-[240px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#3A2660] border border-white/20 shadow-2xl p-3">
              {GENDERS.map((g) => (
                <div key={g.key} className="mb-1">
                  <div className="flex items-center rounded-lg text-white hover:bg-white/10 transition-colors">
                    {/* Tapping the label navigates straight to the gender-only
                        filter; the chevron is a separate target that only
                        expands the age list, so neither action steals the
                        other's tap. */}
                    <Link
                      to={genderLinkFor(g.key)}
                      onClick={closeAll}
                      className="flex-1 px-3 py-2 text-sm font-heading font-bold"
                    >
                      {t(g.labelKey)}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === g.key ? null : g.key)}
                      className="px-3 py-2"
                      aria-label={t('gender.ages')}
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded === g.key ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {expanded === g.key && (
                    <div className="mt-1 ps-3">
                      <p className="px-2 pb-1 text-[11px] uppercase tracking-wider text-white/50 font-heading font-bold">
                        {t('gender.ages')}
                      </p>
                      <AgesList gender={g.key} itemClass="px-2 py-1 text-xs whitespace-nowrap" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Desktop: hover mega-menu. First level = Boys / Girls. The ages column only
  // appears once a gender is hovered/clicked, so ages are never shown upfront.
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { setOpen(false); setHovered(null); }}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap"
      >
        {t('nav.shopByGender')} <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute start-0 top-full z-[60] pt-2">
          <div
            className={`rounded-2xl bg-[#3A2660] border border-white/20 shadow-2xl p-4 transition-all ${
              hovered ? 'min-w-[420px] grid grid-cols-2 gap-5' : 'min-w-[180px]'
            }`}
          >
            <div>
              {GENDERS.map((g) => (
                <div
                  key={g.key}
                  onMouseEnter={() => setHovered(g.key)}
                  className={`w-full flex items-center justify-between rounded-lg text-sm font-heading font-bold transition-colors ${
                    hovered === g.key ? 'bg-white/15 text-accent' : 'text-white hover:bg-white/10'
                  }`}
                >
                  {/* Label navigates straight to the gender-only filter;
                      the chevron only reveals the age submenu (hovering the
                      row already does the same, this covers click/keyboard). */}
                  <Link to={genderLinkFor(g.key)} onClick={closeAll} className="flex-1 px-3 py-2">
                    {t(g.labelKey)}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setHovered(g.key)}
                    className="px-3 py-2"
                    aria-label={t('gender.ages')}
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              ))}
            </div>
            {hovered && (
              <div>
                <p className="px-3 pb-1.5 text-[11px] uppercase tracking-wider text-white/50 font-heading font-bold">
                  {t('gender.ages')}
                </p>
                <AgesList gender={hovered} itemClass="px-3 py-1.5 text-sm" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}