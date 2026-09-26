import { useCallback, useState } from 'react';
import { guardedFetch, SessionExpiredError } from '@/lib/adminLoad';

// `guard(fetcher)` resolves with the fetched data, or `undefined` when the load
// failed — in which case `failure` is 'session' (expired login) or 'error'
// (anything else). Callers only apply the data when it is not undefined, so a
// failed request is never turned into an empty list.
export function useAdminLoadGuard() {
  const [failure, setFailure] = useState(null);

  const guard = useCallback(async (fetcher) => {
    try {
      const data = await guardedFetch(fetcher);
      setFailure(null);
      return data;
    } catch (err) {
      setFailure(err instanceof SessionExpiredError ? 'session' : 'error');
      return undefined;
    }
  }, []);

  return { failure, guard };
}
