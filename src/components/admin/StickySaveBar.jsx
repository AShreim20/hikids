import React from 'react';

// Sticky bottom container for a page's Save action. Pins to the bottom of the
// viewport while the form scrolls, with an opaque, blurred backdrop and top
// border so page content never shows through. Spans the parent content column
// (matches the admin pages' px-5 sm:px-8 md:pl-16 paddings) and aligns the
// button with the rest of the form. Does not alter the button itself.
//
// `dirtyCount` is optional — when a caller doesn't pass it (HomepageDealsAdminSettings,
// SiteSettingsAdmin), the bar behaves exactly as before: always visible, just
// renders `children`. When a caller DOES pass it (SiteContentAdmin's tabs),
// the bar only renders while there's something unsaved, shows an accurate
// "N unsaved changes" line, and offers a Cancel button next to `children`
// (the page's own Save button) — one save architecture, reused everywhere
// instead of a second competing one.
export default function StickySaveBar({ children, className = '', dirtyCount, onCancel, ar = true }) {
  if (dirtyCount === 0) return null;
  return (
    <div
      className={`sticky bottom-0 z-30 -mx-5 sm:-mx-8 md:-ml-16 px-5 sm:px-8 md:pl-16 py-4 mt-6 bg-background/95 backdrop-blur-md border-t border-border/60 ${className}`}
    >
      {dirtyCount != null ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-medium text-foreground/80">
            {ar
              ? `لديك ${dirtyCount} ${dirtyCount === 1 ? 'تعديل غير محفوظ' : 'تعديلات غير محفوظة'}`
              : `You have ${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}`}
          </span>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="squish h-12 px-5 rounded-full bg-mist font-heading font-bold"
              >
                {ar ? 'إلغاء التغييرات' : 'Cancel changes'}
              </button>
            )}
            {children}
          </div>
        </div>
      ) : children}
    </div>
  );
}