import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Generic compact quick-filter control for the Product Toolbar: a pill
// button that opens a small popover panel below it, closing on an outside
// click or Escape. Deliberately no external UI/popover library — the whole
// thing is a couple dozen lines and matches the existing HiKids look
// (rounded pill trigger, dark bordered card panel) better than a generic
// dropdown would.
export default function FilterPopover({ label, active, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`squish inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-sm font-heading font-bold transition-colors ${
          active ? 'bg-cosmic text-white' : 'bg-mist text-foreground/80 hover:bg-accent/20'
        }`}
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 start-0 z-30 w-[19rem] max-w-[90vw] max-h-[70vh] overflow-y-auto rounded-3xl bg-card border border-border shadow-2xl p-5 float-in">
          {children}
        </div>
      )}
    </div>
  );
}
