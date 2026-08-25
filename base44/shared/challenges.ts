// Shared helpers for HiKids Challenges, used by the claim + submit-photo +
// review backend functions so challenge eligibility logic lives in one place.

export function inWindow(c) {
  const now = new Date();
  if (c.start_date && now < new Date(c.start_date)) return false;
  if (c.end_date && now > new Date(c.end_date)) return false;
  return true;
}

export async function getOrCreateProgress(base44, challengeId, user) {
  const rows = await base44.asServiceRole.entities.ChallengeProgress.filter({
    challenge_id: challengeId,
    user_email: user.email,
  });
  if (rows && rows.length) return rows[0];
  return base44.asServiceRole.entities.ChallengeProgress.create({
    challenge_id: challengeId,
    user_id: user.id || '',
    user_email: user.email,
    completions: 0,
    rewarded_count: 0,
    recipients: [],
    rewarded_order_ids: [],
  });
}