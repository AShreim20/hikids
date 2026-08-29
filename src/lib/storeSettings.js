import { db } from '@/api/entities';

// Lightweight read/write helper for the Setting entity (key/value where value
// is a number). Used for admin-controlled store toggles such as the Visa
// payment switch. Values are cached in-memory for the session.
const cache = {};

export async function getSetting(key, defaultValue = 0) {
  if (cache[key] !== undefined) return cache[key];
  try {
    const rows = await db.Setting.filter({ key });
    const v = rows && rows.length ? Number(rows[0].value) : defaultValue;
    cache[key] = v;
    return v;
  } catch {
    return defaultValue;
  }
}

export async function setSetting(key, value, description) {
  try {
    const rows = await db.Setting.filter({ key });
    if (rows && rows.length) {
      await db.Setting.update(rows[0].id, { value: Number(value) });
    } else {
      await db.Setting.create({ key, value: Number(value), description });
    }
    cache[key] = Number(value);
    return true;
  } catch {
    return false;
  }
}