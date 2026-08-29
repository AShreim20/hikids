import { createClient } from 'npm:@supabase/supabase-js@2';

// Caller-scoped client: RLS-respecting, identity taken from the request's own
// Authorization header. Equivalent to Base44's createClientFromRequest(req).
export function callerClient(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

export async function getCallerUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) return null;
  const { data, error } = await callerClient(req).auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user;
}

// Service-role client: bypasses RLS. Equivalent to Base44's asServiceRole.
export function serviceRoleClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}
