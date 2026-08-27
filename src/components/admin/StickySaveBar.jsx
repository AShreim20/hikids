import React from 'react';

// Sticky bottom container for a page's Save action. Pins to the bottom of the
// viewport while the form scrolls, with an opaque, blurred backdrop and top
// border so page content never shows through. Spans the parent content column
// (matches the admin pages' px-5 sm:px-8 md:pl-16 paddings) and aligns the
// button with the rest of the form. Does not alter the button itself.
export default function StickySaveBar({ children, className = '' }) {
  return (
    <div
      className={`sticky bottom-0 z-30 -mx-5 sm:-mx-8 md:-ml-16 px-5 sm:px-8 md:pl-16 py-4 mt-6 bg-background/95 backdrop-blur-md border-t border-border/60 ${className}`}
    >
      {children}
    </div>
  );
}