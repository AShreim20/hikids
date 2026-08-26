import { base44 } from '@/api/base44Client';

// Upsert helpers for the SiteContent / SiteSetting singletons used by the
// Site Content admin. Each "content key" (e.g. i18n_overrides, faq_items, about)
// is stored as one SiteContent record; global settings is one SiteSetting
// record keyed "global".

export async function loadContentRecord(key) {
  const recs = await base44.entities.SiteContent.filter({ key });
  return (recs && recs[0]) || null;
}

export async function upsertContent(key, data) {
  const existing = await loadContentRecord(key);
  if (existing) return base44.entities.SiteContent.update(existing.id, { key, data });
  return base44.entities.SiteContent.create({ key, data });
}

export async function loadSettingsRecord() {
  const recs = await base44.entities.SiteSetting.filter({ key: 'global' });
  return (recs && recs[0]) || null;
}

export async function upsertSettings(data) {
  const existing = await loadSettingsRecord();
  const payload = { key: 'global', ...data };
  if (existing) return base44.entities.SiteSetting.update(existing.id, payload);
  return base44.entities.SiteSetting.create(payload);
}