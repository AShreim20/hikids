import { supabase } from '@/api/supabaseClient';

// Thin wrapper around bulk_import_products (migration 0030) — admin-only,
// re-validates everything server-side regardless of what the client sends.
// `updates`: [{ product_code, fields: {...} }], already filtered down to
// only the fields that should actually change for that row.
export async function bulkImportProducts(updates) {
  const { data, error } = await supabase.rpc('bulk_import_products', { p_updates: updates });
  if (error) throw error;
  return data;
}
