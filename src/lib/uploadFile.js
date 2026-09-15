import { supabase } from '@/api/supabaseClient';

// Mirrors base44.integrations.Core.UploadFile({ file }) -> { file_url }.
//
// Default call shape (`uploadFile(file)`) is unchanged and used by every
// admin upload (products, categories, hero slides, bundles, the store
// logo) — it lands at the root of the "uploads" bucket exactly as before,
// so no admin call site needed to change for the storage-security fix (see
// supabase/migrations/0022_secure_storage_buckets.sql).
//
// The two customer-facing uploads (product photo reviews, challenge photo
// submissions) pass { bucket: 'customer-uploads', folder, ownerId } so the
// file lands under `<folder>/<ownerId>/<name>` — the RLS policy on that
// bucket only allows a caller to write into a folder matching their own
// auth.uid(), so a customer can never overwrite another customer's upload
// or reach outside their own reviews/challenges path.
export async function uploadFile(file, { bucket = 'uploads', folder, ownerId } = {}) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const filename = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
  const path = folder && ownerId ? `${folder}/${ownerId}/${filename}` : filename;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_url: data.publicUrl };
}
