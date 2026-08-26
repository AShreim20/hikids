import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { DEFAULT_SETTINGS, DEFAULT_FAQ_ITEMS, DEFAULT_ABOUT } from '@/lib/siteDefaults';
import { setOverridesCache } from '@/lib/i18nOverrides';

// Loads all editable site content + global settings from the DB once on
// mount, merges them over the hard-coded defaults (so nothing disappears before
// the admin saves anything), and keeps them live via entity subscriptions.
// Also pushes the i18n override record into the i18nOverrides cache so the
// existing `t()` function picks admin edits across the whole site.
const SiteContentContext = createContext(null);

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

export function SiteContentProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [contentMap, setContentMap] = useState({});
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const [settingRecs, contentRecs] = await Promise.all([
        base44.entities.SiteSetting.filter({ key: 'global' }),
        base44.entities.SiteContent.list('-updated_date', 100),
      ]);
      const s = (settingRecs && settingRecs[0]) || {};
      const merged = { ...DEFAULT_SETTINGS };
      SETTING_KEYS.forEach((k) => {
        if (s[k] != null && s[k] !== '') merged[k] = s[k];
      });
      setSettings(merged);

      const map = {};
      (contentRecs || []).forEach((r) => {
        map[r.key] = r.data || {};
      });
      setContentMap(map);
      if (map['i18n_overrides']) setOverridesCache(map['i18n_overrides']);
    } catch {
      /* keep defaults */
    }
    setLoaded(true);
  };

  useEffect(() => {
    load();
    let u1, u2;
    try {
      u1 = base44.entities.SiteContent.subscribe(() => load());
    } catch { /* noop */ }
    try {
      u2 = base44.entities.SiteSetting.subscribe(() => load());
    } catch { /* noop */ }
    return () => {
      if (u1) u1();
      if (u2) u2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = (key, defaults = {}) => ({ ...defaults, ...(contentMap[key] || {}) });
  const faqItems = content('faq_items', { items: DEFAULT_FAQ_ITEMS }).items || DEFAULT_FAQ_ITEMS;
  const about = content('about', DEFAULT_ABOUT);

  return (
    <SiteContentContext.Provider value={{ settings, content, faqItems, about, loaded, reload: load }}>
      {children}
    </SiteContentContext.Provider>
  );
}

export const useSiteContent = () => {
  const ctx = useContext(SiteContentContext);
  if (!ctx) {
    return { settings: DEFAULT_SETTINGS, faqItems: DEFAULT_FAQ_ITEMS, about: DEFAULT_ABOUT, content: (_k, d) => d, loaded: false, reload: () => {} };
  }
  return ctx;
};