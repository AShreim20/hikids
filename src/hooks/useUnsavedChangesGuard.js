import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Blocks in-app navigation away from a dirty form and warns on a real
// browser close/reload. This does NOT touch tab-switching/minimizing/losing
// window focus in any way — those never call any of the handlers below,
// so the form is left completely alone when the user just looks away.
//
// Scope (see ProductEditor.jsx's investigation notes for why): classic
// react-router-dom v6 (BrowserRouter, not a data router) has no built-in way
// to block the physical browser Back/Forward buttons short of hand-rolling
// history.pushState tricks that risk desyncing the router's own location
// state — a worse bug than the one being fixed. So this hook reliably covers
// the two real, safe vectors instead:
//   1. Clicking any in-app <Link>/<a> while dirty (sidebar, top nav, back
//      links, breadcrumbs — the actual way admins move between pages here).
//   2. Real browser navigation away (typed URL, tab close, refresh) via the
//      native beforeunload prompt.
// A page's own "Cancel" button is intentionally NOT covered — clicking
// Cancel already *is* the user's explicit choice to discard, so it should
// just navigate, matching how callers use this hook (they call `reset()`
// themselves before navigating on Cancel).
export function useUnsavedChangesGuard(isDirty, onLeave) {
  const navigate = useNavigate();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const [pendingHref, setPendingHref] = useState(null);

  // Native close/reload/typed-URL navigation — only while actually dirty, so
  // it never fires from a plain tab switch or window blur.
  useEffect(() => {
    const handler = (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // In-app link clicks, captured before react-router's own Link handler runs.
  useEffect(() => {
    const handler = (e) => {
      if (!isDirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      let url;
      try {
        url = new URL(a.getAttribute('href'), window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // external link — let beforeunload handle it
      const dest = url.pathname + url.search + url.hash;
      const here = window.location.pathname + window.location.search + window.location.hash;
      if (dest === here) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(dest);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const stay = () => setPendingHref(null);
  const leave = () => {
    const dest = pendingHref;
    setPendingHref(null);
    isDirtyRef.current = false; // let the navigation below through
    onLeave?.();
    if (dest) navigate(dest);
  };

  return { confirmOpen: !!pendingHref, stay, leave };
}
