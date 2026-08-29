import { supabase } from '@/api/supabaseClient';

// Thin wrappers around the Postgres RPC functions from migration 0010 —
// these replace Base44's challengesClaim/challengesSubmitPhoto/
// challengesReview functions. No Edge Function needed, same reasoning as
// orderFunctions.js/loyaltyFunctions.js/wheelFunctions.js.

export async function challengesClaim(challengeId) {
  const { data, error } = await supabase.rpc('challenges_claim', { p_challenge_id: challengeId });
  if (error) throw error;
  return data;
}

export async function challengesSubmitPhoto(challengeId, fileUrl, note = null) {
  const { data, error } = await supabase.rpc('challenges_submit_photo', {
    p_challenge_id: challengeId, p_file_url: fileUrl, p_note: note,
  });
  if (error) throw error;
  return data;
}

export async function challengesReview(submissionId, action = 'approve', note = null) {
  const { data, error } = await supabase.rpc('challenges_review', {
    p_submission_id: submissionId, p_action: action, p_note: note,
  });
  if (error) throw error;
  return data;
}
