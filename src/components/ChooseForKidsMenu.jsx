import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { AGE_OPTIONS } from '@/lib/ages';
import { GENDER_MALE, GENDER_FEMALE } from '@/lib/gender';
import { useMenuSide } from '@/lib/useMenuSide';

// "Choose for Kids" — a nested row inside ShopMenu's dropdown (desktop) or
// accordion (mobile), not a top-level nav trigger itself. Three logical
// levels: this row -> Boys/Girls -> Ages. Reuses the exact gender/age
// filter contract (/shop?gender=&age=) the Shop page already reads from the
// URL — no new filter parameter, no duplicate age/gender system.
const GENDERS = [
  { key: GENDER_MALE, labelKey: 'gender.boys' },
  { key: GENDER_FEMALE, labelKey: 'gender.girls' },
];

const linkFor = (gender, ageId) => `/shop?gender=${gender}&age=${ageId}`;
const genderLinkFor = (gender) => `/shop?gender=${gender}`;

export function ChooseForKidsMenuMobile({ onNavigate }) {
  const { t } = useLanguage();
  const [expandedGender, setExpandedGender] = useState(false); // this row's own accordion
  const [expandedAges, setExpandedAges] = useState(null); // which gender's ages are shown

  return (
    <div>
      <div className="flex items-center rounded-lg text-white hover:bg-white/10 transition-colors">
        <span className="flex-1 px-3 py-2 text-sm font-heading font-bold">{t('nav.chooseForKids')}</span>
        <button
          type="button"
          onClick={() => setExpandedGender((v) => !v)}
          className="px-3 py-2"
          aria-expanded={expandedGender}
          aria-label={t('nav.chooseForKids')}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expandedGender ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {expandedGender && (
        <div className="ms-3 border-s border-white/15 ps-2">
          {GENDERS.map((g) => (
            <div key={g.key} className="mb-1">
              <div className="flex items-center rounded-lg text-white hover:bg-white/10 transition-colors">
                <Link to={genderLinkFor(g.key)} onClick={onNavigate} className="flex-1 px-3 py-1.5 text-sm">
                  {t(g.labelKey)}
                </Link>
                <button
                  type="button"
                  onClick={() => setExpandedAges(expandedAges === g.key ? null : g.key)}
                  className="px-3 py-1.5"
                  aria-expanded={expandedAges === g.key}
                  aria-label={t('gender.ages')}
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedAges === g.key ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {expandedAges === g.key && (
                <ul className="ms-3 border-s border-white/15 ps-2 space-y-0.5">
                  {AGE_OPTIONS.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={linkFor(g.key, a.id)}
                        onClick={onNavigate}
                        className="block rounded-lg px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 hover:text-accent transition-colors whitespace-nowrap"
                      >
                        {t(`age.${a.id}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChooseForKidsMenuDesktop({ onNavigate }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hoveredGender, setHoveredGender] = useState(null);
  const [genderPanelRef, genderSide] = useMenuSide(open);
  // Ages starts from wherever Gender actually ended up, so the cascade
  // keeps extending the same direction instead of folding back on itself.
  const [agesPanelRef, agesSide] = useMenuSide(!!hoveredGender, genderSide);

  const close = () => {
    setOpen(false);
    setHoveredGender(null);
    onNavigate?.();
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { setOpen(false); setHoveredGender(null); }}
    >
      <div
        className={`w-full flex items-center justify-between rounded-lg text-sm font-medium transition-colors ${
          open ? 'bg-white/10 text-accent' : 'text-white hover:bg-white/10'
        }`}
      >
        <span className="flex-1 px-3 py-2">{t('nav.chooseForKids')}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-2"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={t('nav.chooseForKids')}
        >
          <ChevronRight className="w-4 h-4 rtl:rotate-180" />
        </button>
      </div>

      {open && (
        <div ref={genderPanelRef} className={`absolute top-0 ${genderSide}-full ${genderSide === 'start' ? 'ms-1.5' : 'me-1.5'} z-[70]`}>
          <div className="min-w-[160px] rounded-2xl bg-[#3A2660] border border-white/20 shadow-2xl p-2">
            {GENDERS.map((g) => (
              <div
                key={g.key}
                onMouseEnter={() => setHoveredGender(g.key)}
                className={`relative flex items-center justify-between rounded-lg text-sm font-heading font-bold transition-colors ${
                  hoveredGender === g.key ? 'bg-white/15 text-accent' : 'text-white hover:bg-white/10'
                }`}
              >
                <Link to={genderLinkFor(g.key)} onClick={close} className="flex-1 px-3 py-2">
                  {t(g.labelKey)}
                </Link>
                <button
                  type="button"
                  onClick={() => setHoveredGender(g.key)}
                  className="px-3 py-2"
                  aria-label={t('gender.ages')}
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>

                {hoveredGender === g.key && (
                  <div ref={agesPanelRef} className={`absolute top-0 ${agesSide}-full ${agesSide === 'start' ? 'ms-1.5' : 'me-1.5'} z-[80]`}>
                    <div className="min-w-[140px] rounded-2xl bg-[#3A2660] border border-white/20 shadow-2xl p-2">
                      <p className="px-3 pb-1 text-[11px] uppercase tracking-wider text-white/50 font-heading font-bold whitespace-nowrap">
                        {t('gender.ages')}
                      </p>
                      <ul className="space-y-0.5">
                        {AGE_OPTIONS.map((a) => (
                          <li key={a.id}>
                            <Link
                              to={linkFor(g.key, a.id)}
                              onClick={close}
                              className="block rounded-lg px-3 py-1.5 text-sm text-white hover:bg-white/15 hover:text-accent transition-colors whitespace-nowrap"
                            >
                              {t(`age.${a.id}`)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
