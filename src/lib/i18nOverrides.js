// In-memory cache of admin-edited translation overrides, loaded from the
// SiteContent entity (key = "i18n_overrides"). LanguageContext.t() consults this
// cache before falling back to the static translations file, so an admin edit
// to any translation key takes effect across the whole site without a deploy.
// SiteContentContext keeps this cache in sync (including realtime updates).

let overrides = { en: {}, ar: {} };
const listeners = new Set();

export function getOverrides() {
  return overrides;
}

export function subscribeOverrides(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setOverridesCache(data) {
  overrides = {
    en: (data && data.en) || {},
    ar: (data && data.ar) || {},
  };
  listeners.forEach((f) => f());
}