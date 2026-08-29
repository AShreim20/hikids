import { db } from '@/api/entities';

// Upsert helpers for the SiteContent / SiteSetting singletons used by the
// Site Content admin. Each "content key" (e.g. i18n_overrides, faq_items, about)
// is stored as one SiteContent record; global settings is one SiteSetting
// record keyed "global".

export async function loadContentRecord(key) {
  const recs = await db.SiteContent.filter({ key });
  return (recs && recs[0]) || null;
}

export async function upsertContent(key, data) {
  const existing = await loadContentRecord(key);
  if (existing) return db.SiteContent.update(existing.id, { key, data });
  return db.SiteContent.create({ key, data });
}

// DEFAULT_SETTINGS (src/lib/siteDefaults.js) and the admin form use camelCase
// keys; the site_settings table uses snake_case columns. Map between them
// here so the rest of the app can keep using camelCase.
const SETTINGS_KEY_MAP = {
  storeName: 'store_name',
  logoUrl: 'logo_url',
  phoneTel: 'phone_tel',
  addressAr: 'address_ar',
  addressEn: 'address_en',
  hoursAr: 'hours_ar',
  hoursEn: 'hours_en',
};

export function dbToSettings(row) {
  if (!row) return null;
  const out = {};
  for (const [jsKey, dbKey] of Object.entries(SETTINGS_KEY_MAP)) {
    if (row[dbKey] != null) out[jsKey] = row[dbKey];
  }
  for (const passthroughKey of ['phone', 'whatsapp', 'email', 'instagram', 'facebook']) {
    if (row[passthroughKey] != null) out[passthroughKey] = row[passthroughKey];
  }
  return out;
}

function settingsToDb(data) {
  const out = {};
  for (const [jsKey, value] of Object.entries(data)) {
    const dbKey = SETTINGS_KEY_MAP[jsKey] || jsKey;
    out[dbKey] = value;
  }
  return out;
}

export async function loadSettingsRecord() {
  const recs = await db.SiteSetting.filter({ key: 'global' });
  return (recs && recs[0]) || null;
}

export async function upsertSettings(data) {
  const existing = await loadSettingsRecord();
  const payload = { key: 'global', ...settingsToDb(data) };
  if (existing) return db.SiteSetting.update(existing.id, payload);
  return db.SiteSetting.create(payload);
}
