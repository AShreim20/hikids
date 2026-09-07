// Per-entity draft persistence for large admin edit forms (sessionStorage —
// cleared when the tab closes, unlike localStorage, since a draft is only
// meant to survive an accidental remount within the same browsing session,
// not to linger indefinitely). Every key is scoped to one entity id, so a
// draft for product A can never be read back for product B.
//
// Each draft also carries the `baseline` (the server row's own updated_date
// at the moment the draft was taken) so a caller can tell whether the server
// has since moved on — see productDraftKey usage in ProductEditor.jsx.

function draftKey(namespace, entityId) {
  return `hikids:${namespace}-draft:${entityId || 'new'}`;
}

export function saveDraft(namespace, entityId, data, baseline) {
  try {
    sessionStorage.setItem(draftKey(namespace, entityId), JSON.stringify({ data, baseline, savedAt: Date.now() }));
  } catch {
    // Storage full/unavailable (private mode, quota) — the draft is a
    // convenience, not a requirement, so fail silently.
  }
}

export function loadDraft(namespace, entityId) {
  try {
    const raw = sessionStorage.getItem(draftKey(namespace, entityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(namespace, entityId) {
  try {
    sessionStorage.removeItem(draftKey(namespace, entityId));
  } catch {
    // ignore
  }
}

// Preview snapshots — a separate, short-lived namespace from the drafts
// above (never merged with the autosave-recovery draft, and never written to
// the database). The editor writes the *current in-memory form* here right
// before opening a preview tab; a window opened via window.open() from the
// same origin shares sessionStorage with its opener, so the new tab reads it
// straight back — including whatever the admin typed but hasn't saved yet.
// `kind` scopes this to a given entity type (defaults to 'product', the
// original use — kept as the default so existing call sites don't need to
// change) so a product preview and, say, a hero-slide preview can never read
// each other's snapshot.
function previewKey(kind, entityId) {
  return `hikids:${kind}-preview:${entityId || 'new'}`;
}

export function savePreviewSnapshot(entityId, data, kind = 'product') {
  try {
    sessionStorage.setItem(previewKey(kind, entityId), JSON.stringify(data));
  } catch {
    // Preview is a convenience — if storage is unavailable, the preview tab
    // simply falls back to the last saved DB version (or "not found" for a
    // never-saved entity).
  }
}

export function loadPreviewSnapshot(entityId, kind = 'product') {
  try {
    const raw = sessionStorage.getItem(previewKey(kind, entityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
