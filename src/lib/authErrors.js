// Maps the English messages Supabase Auth returns to our translated strings.
// Unknown messages are shown as-is in English; in Arabic they fall back to a
// generic translated message instead of leaking raw English into the UI.
const RULES = [
  [/invalid login credentials/i, 'auth.err.login'],
  [/user already registered|already been registered/i, 'auth.err.exists'],
  [/email not confirmed/i, 'auth.err.unconfirmed'],
  [/rate limit|too many requests|after \d+ seconds?/i, 'auth.err.rate'],
  [/should be different from the old password|same as the old password/i, 'auth.err.samePassword'],
  [/password should be at least|password is too short|weak password/i, 'auth.err.shortPassword'],
];

export function authErrorMessage(err, { t, lang }, fallbackKey) {
  const msg = String(err?.message || '');
  for (const [re, key] of RULES) {
    if (re.test(msg)) return t(key);
  }
  if (lang === 'ar' || !msg) return t(fallbackKey);
  return msg;
}
