import { supabase } from '@/api/supabaseClient';

// Shared "did this admin list really load?" logic. Admin list pages used to
// swallow any failed request into `[]`, so an expired login looked exactly like
// "no orders / no returns / no expenses". This separates three outcomes:
//   - success (including a genuinely empty list)  -> data is returned as-is
//   - expired/invalid session                     -> SessionExpiredError
//   - any other failure (network, server, RLS)    -> the original error
//
// Two ways a stale session shows up, both handled:
//   1. An explicit auth error (JWT expired / 401).
//   2. A *silent* empty result: RLS returns zero rows, no error, for a caller
//      whose token no longer counts as logged in. So an empty result is
//      verified against the auth server (getUser) before it is trusted, and is
//      re-fetched once if the session turns out to be valid (a request that
//      raced a token refresh). Only a still-empty answer from a confirmed valid
//      session is accepted as "genuinely empty".

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

const JWT_MESSAGE = /jwt (is )?(expired|invalid)|invalid jwt|token is expired|not authenticated|auth session missing/i;

function errorText(err) {
  return `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`;
}

// Definitely an auth problem, no server round-trip needed.
function isDefiniteAuthError(err) {
  return ['PGRST301', 'PGRST302', 'PGRST303'].includes(err?.code) || JWT_MESSAGE.test(errorText(err));
}

// Could be either an expired session or a plain permission denial, so the
// session itself is checked before deciding.
function isAmbiguousAuthError(err) {
  return err?.status === 401 || err?.status === 403 || err?.code === '42501';
}

// 'valid' | 'expired' | 'unknown' (auth server unreachable -> not a verdict)
export async function checkSession() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (data?.user) return 'valid';
    if (!error) return 'expired';
    const status = error.status;
    if (error.name === 'AuthSessionMissingError' || status === 400 || status === 401 || status === 403) return 'expired';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// True for [], null, and tuples (Promise.all results) whose parts are all
// empty. Any non-empty leaf value means there is real data to show.
export function isEmptyResult(data) {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0 || data.every(isEmptyResult);
  return false;
}

async function attempt(fetcher) {
  try {
    return await fetcher();
  } catch (err) {
    if (err instanceof SessionExpiredError) throw err;
    if (isDefiniteAuthError(err)) throw new SessionExpiredError();
    if (isAmbiguousAuthError(err) && (await checkSession()) === 'expired') throw new SessionExpiredError();
    throw err;
  }
}

// Runs `fetcher` (a function returning a promise of the page's data) and
// returns its result, or throws SessionExpiredError / the original error.
export async function guardedFetch(fetcher) {
  const data = await attempt(fetcher);
  if (!isEmptyResult(data)) return data;

  const session = await checkSession();
  if (session === 'expired') throw new SessionExpiredError();
  if (session === 'unknown') throw new Error('Could not verify session');
  return attempt(fetcher);
}
