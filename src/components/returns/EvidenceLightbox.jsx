import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// Shared full-image evidence viewer for Return Request photos — same
// lightweight fixed-overlay pattern Reviews.jsx already uses for review
// photos, extended with prev/next since a request can have several photos
// (section 20: "move between evidence images... inspect full image without
// distortion"). Always `object-contain`, never cropped.
export default function EvidenceLightbox({ urls, index, onClose, onNavigate }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate((index + 1) % urls.length);
      if (e.key === 'ArrowLeft') onNavigate((index - 1 + urls.length) % urls.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, urls.length, onClose, onNavigate]);

  if (index == null || !urls?.length) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm grid place-items-center p-4 sm:p-10 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        className="absolute top-5 end-5 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>
      {urls.length > 1 && (
        <>
          <button
            className="absolute start-3 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onNavigate((index - 1 + urls.length) % urls.length); }}
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
          </button>
          <button
            className="absolute end-3 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); onNavigate((index + 1) % urls.length); }}
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6 rtl:rotate-180" />
          </button>
        </>
      )}
      <img
        src={urls[index]}
        alt=""
        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {urls.length > 1 && (
        <p className="absolute bottom-5 text-white/70 text-sm font-medium" dir="ltr">
          {index + 1} / {urls.length}
        </p>
      )}
    </div>
  );
}

export function useLightbox() {
  const [state, setState] = useState(null); // { urls, index } | null
  return {
    open: (urls, index = 0) => setState({ urls, index }),
    close: () => setState(null),
    navigate: (index) => setState((s) => (s ? { ...s, index } : s)),
    state,
  };
}
