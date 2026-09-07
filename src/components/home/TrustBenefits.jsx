import React from 'react';
import { Leaf, Wallet, Truck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Some admin-entered translation overrides (site_content -> i18n_overrides)
// still carry a leading emoji baked into the title text itself (e.g. "🧸
// خامات آمنة ومختارة") from before proper icons were used here. Strip it at
// render time rather than rewriting the admin's saved CMS content.
function cleanTitle(text) {
  if (!text) return text;
  return text.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();
}

const ITEMS = [
  { icon: Leaf, titleKey: 'promise.sustain', descKey: 'promise.sustainDesc' },
  { icon: Wallet, titleKey: 'promise.pay', descKey: 'promise.payDesc' },
  { icon: Truck, titleKey: 'promise.delivery', descKey: 'promise.deliveryDesc' },
];

// Compact trust/benefit strip directly below the Hero. Content stays fully
// admin-managed via t() (translations.js + i18n_overrides) — only the
// presentation here is new.
export default function TrustBenefits() {
  const { t } = useLanguage();

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-4 sm:py-5 md:py-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {ITEMS.map(({ icon: Icon, titleKey, descKey }) => (
          <div
            key={titleKey}
            className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-border/50 bg-mist/60 px-4 py-3 sm:px-5 sm:py-4 shadow-sm transition-colors hover:border-cosmic/30 hover:bg-mist hover:shadow-md"
          >
            <div className="shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-cosmic/10 text-cosmic transition-colors">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm sm:text-[15px] leading-snug">
                {cleanTitle(t(titleKey))}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-snug line-clamp-2">
                {(t(descKey) || '').trim()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
