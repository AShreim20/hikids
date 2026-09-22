import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/AuthContext';
import { publishActionItems, useActionItems } from '@/lib/actionRequiredStore';
import { useLanguage } from '@/context/LanguageContext';

// One site-wide "Action Required" entry, opened either from its own floating
// button or from an admin nav "action" item (openActionRequired() dispatches
// the toggle event this listens for). The list is derived live on the server
// (action_required_items) from the real workflow state, so an item
// disappears / changes to the next step as soon as the actual action is done.
// Renders the floating button only when the signed-in user actually has
// something to do; the panel itself can still be toggled open with none.
const waiting = (since, ar) => {
  const h = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 36e5));
  if (h < 1) return ar ? 'الآن' : 'just now';
  if (h < 48) return ar ? `منذ ${h} ساعة` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return ar ? `منذ ${d} يوم` : `${d}d ago`;
};

export default function ActionRequiredCenter() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { pathname } = useLocation();
  const ar = lang === 'ar';
  const items = useActionItems();
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    if (!user) { publishActionItems([]); return; }
    supabase.rpc('action_required_items').then(({ data, error }) => {
      if (!error && Array.isArray(data)) publishActionItems(data);
    });
  }, [user]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, pathname]);

  useEffect(() => { setOpen(false); }, [pathname]);
  // Every trigger (this button, the admin sidebar/menu "Action Required"
  // item) fires the same event -- toggling here means pressing any of them
  // again, while the panel is already open, closes it.
  useEffect(() => {
    const togglePanel = () => setOpen((v) => !v);
    window.addEventListener('hikids:open-action-required', togglePanel);
    return () => window.removeEventListener('hikids:open-action-required', togglePanel);
  }, []);

  if (!user || (items.length === 0 && !open)) return null;

  const sections = [
    { key: 'admin', title: ar ? 'الإجراءات المطلوبة' : 'Action Required' },
    { key: 'customer', title: ar ? 'إجراءات مطلوبة منك' : 'Needs your action' },
  ].map((s) => ({ ...s, rows: items.filter((i) => i.audience === s.key) })).filter((s) => s.rows.length);
  const urgent = items.some((i) => i.priority === 'urgent');

  return (
    <>
      {/* Floating trigger -- hidden while items.length is 0 unless something
          else (the admin sidebar/menu) already asked for the panel to open. */}
      {items.length > 0 && (
        <div className="fixed z-50 bottom-24 start-4 md:start-auto md:end-6 md:bottom-44" dir={ar ? 'rtl' : 'ltr'}>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`relative grid place-items-center w-12 h-12 rounded-full text-white shadow-xl ${urgent ? 'bg-destructive' : 'bg-cosmic'}`}
            aria-label={ar ? 'الإجراءات المطلوبة' : 'Action Required'}
            title={ar ? 'الإجراءات المطلوبة' : 'Action Required'}
          >
            <BellRing className="w-5 h-5" />
            <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">{items.length}</span>
          </button>
        </div>
      )}

      {/* The panel itself is always a side sheet, whichever trigger opened it. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={ar ? 'right' : 'left'} className="w-[85vw] max-w-sm p-0 flex flex-col" dir={ar ? 'rtl' : 'ltr'}>
          <div className="shrink-0 px-5 py-4 border-b border-border/60">
            <SheetTitle className="font-heading font-extrabold text-lg">{ar ? 'الإجراءات المطلوبة' : 'Action Required'}</SheetTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{ar ? 'لا توجد إجراءات مطلوبة' : 'Nothing needs your action'}</p>}
            {sections.map((s) => (
              <div key={s.key} className="mt-2 first:mt-0">
                {sections.length > 1 && <p className="text-xs text-muted-foreground font-heading font-bold mb-1.5 px-1">{s.title}</p>}
                <div className="grid gap-2">
                  {s.rows.map((i, idx) => (
                    <div key={`${i.route}-${i.ref}-${idx}`} className={`rounded-2xl p-3 text-sm ${i.priority === 'urgent' ? 'bg-destructive/10' : 'bg-mist/60'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-heading font-bold" dir="ltr">{i.ref}</span>
                        <span className="text-xs text-muted-foreground">{waiting(i.since, ar)}</span>
                      </div>
                      {i.customer && <p className="text-xs text-muted-foreground">{i.customer}</p>}
                      <p className="mt-1">{ar ? i.title_ar : i.title_en}</p>
                      <Link to={i.route} onClick={() => setOpen(false)} className="mt-2 inline-flex h-9 items-center px-3 rounded-full bg-cosmic text-white text-xs font-heading font-bold">
                        {ar ? i.action_ar : i.action_en}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
