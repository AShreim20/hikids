import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, Banknote, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Compact reassurance strip for ProductDetail/Cart — the pre-launch review
// found trust info only lived in the FAQ, not where the buying decision
// actually happens. Wording is pulled straight from the live FAQ content
// (see translations.js's trust.* keys) rather than invented: delivery
// timing and cash-on-delivery are the real, currently-supported policies;
// returns/exchanges deliberately says "contact us" rather than promising a
// specific day count or free/flat shipping, since neither is actually live
// right now (card payment is also currently disabled store-wide, so it's
// intentionally left out here).
//
// `variant="compact"` (Cart, right above checkout) condenses to one small
// wrapped line instead of ProductDetail's icon-per-item row, per the "don't
// repeat a large section in Cart" instruction.
export default function TrustStrip({ variant = 'full', className = '' }) {
  const { t } = useLanguage();

  const items = [
    { icon: Truck, label: t('trust.delivery') },
    { icon: Banknote, label: t('checkout.cod') },
    { icon: RotateCcw, label: t('trust.returns') },
  ];

  if (variant === 'compact') {
    return (
      <Link
        to="/faq"
        title={t('trust.linkHint')}
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground hover:text-foreground transition-colors ${className}`}
      >
        {items.map(({ icon: Icon, label }, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 shrink-0 text-cosmic" />
            {label}
          </span>
        ))}
      </Link>
    );
  }

  return (
    <Link
      to="/faq"
      title={t('trust.linkHint')}
      className={`grid grid-cols-3 gap-2 rounded-2xl bg-mist p-4 hover:bg-mist/70 transition-colors ${className}`}
    >
      {items.map(({ icon: Icon, label }, i) => (
        <span key={i} className="flex flex-col items-center gap-1.5 text-center">
          <Icon className="w-5 h-5 text-cosmic" />
          <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
        </span>
      ))}
    </Link>
  );
}
