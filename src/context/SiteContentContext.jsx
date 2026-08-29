import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { dbToSettings } from '@/lib/siteContent';
import { DEFAULT_SETTINGS, DEFAULT_FAQ_ITEMS, DEFAULT_ABOUT } from '@/lib/siteDefaults';
import { setOverridesCache } from '@/lib/i18nOverrides';

// Loads all editable site content + global settings from the DB once on
// mount, merges them over the hard-coded defaults (so nothing disappears before
// the admin saves anything), and keeps them live via realtime subscriptions.
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
        db.SiteSetting.filter({ key: 'global' }),
        db.SiteContent.list('-updated_date', 100),
      ]);
      const s = dbToSettings((settingRecs && settingRecs[0]) || null) || {};
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
    const channel = supabase
      .channel('site-content-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
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
