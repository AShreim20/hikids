import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { AGE_OPTIONS } from '@/lib/ages';

// "Shop by Gender" header menu. Two levels: the first shows only Boys / Girls;
// hovering (desktop) or tapping (mobile) a gender reveals an "Ages" submenu
// with the existing structured age ranges. Selecting an age navigates to
// /shop with gender + age pre-applied — no separate filter system.
const GENDERS = [
  { key: 'Boy', labelKey: 'gender.boys' },
  { key: 'Girl', labelKey: 'gender.girls' },
];

const PANEL = 'rounded-2xl bg-[#5D3F85] border border-white/15 shadow-xl';
const ITEM = 'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap';
const ITEM_IDLE = 'text-white/85 hover:bg-white/10 hover:text-accent';
const ITEM_ACTIVE = 'bg-white/10 text-accent';
const AGE_LINK = 'block px-2.5 py-1.5 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-accent transition-colors whitespace-nowrap';
const AGE_HEADING = 'font-heading font-bold text-white/55 text-[11px] uppercase tracking-wider px-2 mb-1';

export default function ShopByGenderMenu({ mobile = false, onNavigate }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null); // 'Boy' | 'Girl' | null

  const closeAll = () => {
    setOpen(false);
    setActive(null);
  };
  const linkFor = (gender, ageId) => `/shop?gender=${gender}&age=${ageId}`;

  if (mobile) {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setActive(null);
          }}
          className="inline-flex items-center gap-1 text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap"
        >
          {t('nav.shopByGender')}{' '}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeAll} />
            <div className={`absolute end-0 top-full mt-2 z-50 min-w-[170px] p-1.5 ${PANEL}`}>
              {GENDERS.map((g) => (
                <div key={g.key}>
                  <button
                    type="button"
                    onClick={() => setActive((a) => (a === g.key ? null : g.key))}
                    className={`w-full ${ITEM} ${active === g.key ? ITEM_ACTIVE : ITEM_IDLE}`}
                  >
                    {t(g.labelKey)}
                    <ChevronDown className={`w-4 h-4 transition-transform ${active === g.key ? 'rotate-180' : ''}`} />
                  </button>
                  {active === g.key && (
                    <div className="mt-1 mb-1 ps-2">
                      <p className={AGE_HEADING}>{t('nav.ages')}</p>
                      {AGE_OPTIONS.map((a) => (
                        <Link
                          key={a.id}
                          to={linkFor(g.key, a.id)}
                          onClick={() => {
                            closeAll();
                            onNavigate?.();
                          }}
                          className={AGE_LINK}
                        >
                          {t(`age.${a.id}`)}
                        </Link>
                      ))}
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

  // Desktop: hover dropdown, fly-out age submenu per gender.
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={closeAll}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-medium text-white/85 hover:text-accent transition-colors whitespace-nowrap"
      >
        {t('nav.shopByGender')} <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute start-0 top-full z-50 pt-2">
          <div className={`min-w-[170px] p-1.5 ${PANEL}`}>
            <ul>
              {GENDERS.map((g) => (
                <li key={g.key} className="relative" onMouseEnter={() => setActive(g.key)}>
                  <button
                    type="button"
                    className={`w-full ${ITEM} ${active === g.key ? ITEM_ACTIVE : ITEM_IDLE}`}
                  >
                    {t(g.labelKey)}
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                  {active === g.key && (
                    <div className="absolute start-full top-0 ps-2">
                      <div className={`p-3 min-w-[180px] ${PANEL}`}>
                        <p className={AGE_HEADING}>{t('nav.ages')}</p>
                        <ul>
                          {AGE_OPTIONS.map((a) => (
                            <li key={a.id}>
                              <Link
                                to={linkFor(g.key, a.id)}
                                onClick={() => {
                                  closeAll();
                                  onNavigate?.();
                                }}
                                className={AGE_LINK}
                              >
                                {t(`age.${a.id}`)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}