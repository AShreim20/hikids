// Supabase Edge Functions don't send CORS headers by default. Browser-based
// callers (supabase-js's functions.invoke, or any fetch from the app) send a
// preflight OPTIONS request first and then reject the real response unless
// these headers are present — server-to-server tools like curl never hit
// this, which is why that path can pass local verification while the actual
// browser silently fails with "Failed to send a request to the Edge Function".
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Call first in every handler: short-circuits the preflight request.
export function handlePreflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

// Drop-in replacement for Response.json(...) that always carries the CORS
// headers alongside any custom status/headers.
export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: { ...corsHeaders, ...(init.headers || {}) },
  });
}
