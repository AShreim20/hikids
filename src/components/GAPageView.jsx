import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { gaPageView } from '@/lib/ga4';

// Sends exactly one GA4 page_view per real route change — never on the
// initial load's gtag auto-event (disabled in ga4.js's initGA via
// send_page_view: false) and never on a same-path re-render, since this
// effect only re-runs when pathname/search actually change.
//
// Timing: the routed page's own useDocumentMeta() call is what sets the
// real document.title, and React commits this component's effect before
// that page component's title effect runs — so reading document.title right
// away would send the PREVIOUS page's title. A page whose title is set
// synchronously (most of them) updates it well within a tick; a page like
// ProductDetail that fetches data first (confirmed by testing — see the
// task's verification notes) can take longer. A MutationObserver on <title>
// reports the real change the instant it happens for either case, with a
// bounded fallback so a page_view is never delayed indefinitely or lost if
// a title somehow never changes (e.g. a 404).
export default function GAPageView() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      gaPageView(pathname + search, document.title);
    };

    const titleEl = document.querySelector('title');
    const observer = titleEl && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(send)
      : null;
    observer?.observe(titleEl, { childList: true });

    const fallback = setTimeout(send, 800);
    return () => {
      observer?.disconnect();
      clearTimeout(fallback);
    };
  }, [pathname, search]);
  return null;
}
