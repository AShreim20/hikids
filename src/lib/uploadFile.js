import { supabase } from '@/api/supabaseClient';

// Mirrors base44.integrations.Core.UploadFile({ file }) -> { file_url }.
export async function uploadFile(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
  const { error } = await supabase.storage.from('uploads').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('uploads').getPublicUrl(path);
  return { file_url: data.publicUrl };
}
