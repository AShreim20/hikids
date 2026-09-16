import { useLocation } from 'react-router-dom';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { isPrivatePath } from '@/lib/seoPaths';

// Centralized noindex switch for every private/transactional/admin route —
// one component, mounted once, instead of adding a noindex call to ~20
// individual pages (and automatically covering any future route under an
// existing private prefix, e.g. a new /admin/* page, with zero extra work).
// robots.txt (api/robots.js) already Disallows crawling these paths from the
// same PRIVATE_PATH_PREFIXES list — this is the defense-in-depth layer for
// a page that still gets indexed by URL alone (a stray backlink, a shared
// link) without ever being crawled.
//
// Public pages are untouched here: each sets its own real title/description
// via its own useDocumentMeta() call, and this component only flips the
// robots meta back to "index, follow" for them (the hook's own default).
export default function RouteMeta() {
  const { pathname } = useLocation();
  useDocumentMeta({ noindex: isPrivatePath(pathname) });
  return null;
}
