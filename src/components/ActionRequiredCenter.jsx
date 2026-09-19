import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { publishActionItems, useActionItems } from '@/lib/actionRequiredStore';
import { useLanguage } from '@/context/LanguageContext';

// One site-wide "Action Required" entry. The list is derived live on the
// server (action_required_items) from the real workflow state, so an item
// disappears / changes to the next step as soon as the actual action is done.
// Renders nothing unless the signed-in user actually has something to do.
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
  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener('hikids:open-action-required', openPanel);
    return () => window.removeEventListener('hikids:open-action-required', openPanel);
  }, []);

  if (!user || (items.length === 0 && !open)) return null;

  const sections = [
    { key: 'admin', title: ar ? 'الإجراءات المطلوبة' : 'Action Required' },
    { key: 'customer', title: ar ? 'إجراءات مطلوبة منك' : 'Needs your action' },
  ].map((s) => ({ ...s, rows: items.filter((i) => i.audience === s.key) })).filter((s) => s.rows.length);
  const urgent = items.some((i) => i.priority === 'urgent');

  return (
    <div className="fixed z-50 bottom-24 start-4 md:start-auto md:end-6 md:bottom-44" dir={ar ? 'rtl' : 'ltr'}>
      {open && (
        <div className="mb-3 w-[min(92vw,22rem)] max-h-[70vh] overflow-y-auto rounded-3xl bg-card border border-border/60 shadow-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="font-heading font-extrabold">{ar ? 'الإجراءات المطلوبة' : 'Action Required'}</p>
            <button onClick={() => setOpen(false)} aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
          {items.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{ar ? 'لا توجد إجراءات مطلوبة' : 'Nothing needs your action'}</p>}
          {sections.map((s) => (
            <div key={s.key} className="mt-3">
              {sections.length > 1 && <p className="text-xs text-muted-foreground font-heading font-bold mb-1">{s.title}</p>}
              <div className="grid gap-2">
                {s.rows.map((i, idx) => (
                  <div key={`${i.route}-${i.ref}-${idx}`} className={`rounded-2xl p-3 text-sm ${i.priority === 'urgent' ? 'bg-destructive/10' : 'bg-mist/60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-heading font-bold" dir="ltr">{i.ref}</span>
                      <span className="text-xs text-muted-foreground">{waiting(i.since, ar)}</span>
                    </div>
                    {i.customer && <p className="text-xs text-muted-foreground">{i.customer}</p>}
                    <p className="mt-1">{ar ? i.title_ar : i.title_en}</p>
                    <Link to={i.route} className="mt-2 inline-flex h-8 items-center px-3 rounded-full bg-cosmic text-white text-xs font-heading font-bold">
                      {ar ? i.action_ar : i.action_en}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
  );
}
