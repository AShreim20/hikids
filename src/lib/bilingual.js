// Bilingual name resolution. Arabic is mandatory; English is optional.
// Display rule:
//   - Arabic system  -> Arabic name (fall back to English only if Arabic empty)
//   - English system  -> English name if present, otherwise Arabic name
// Never returns an empty string unless both names are empty.

export const pickName = (ar, en, lang) => {
  const a = ar == null ? '' : String(ar).trim();
  const e = en == null ? '' : String(en).trim();
  if (lang === 'en') return e || a;
  return a || e;
};

// Entity-specific wrappers — keep call sites readable and consistent.
export const productName = (p, lang) => pickName(p?.name, p?.name_en, lang);

// Category: Arabic name is mandatory, English is optional. Products link to
// categories by their Arabic `name`, so this only affects display.
export const categoryName = (c, lang) => pickName(c?.name, c?.name_en, lang);

// Category description follows the same rule: Arabic is mandatory, English is
// optional and falls back to Arabic when empty.
export const categoryDescription = (c, lang) =>
  pickName(c?.description, c?.description_en, lang);

// WheelReward uses `label` as its primary (Arabic) name.
export const rewardName = (r, lang) => pickName(r?.label, r?.label_en, lang);

export const challengeName = (c, lang) => pickName(c?.name, c?.name_en, lang);

// A challenge's reward has its own optional bilingual label.
export const challengeRewardLabel = (c, lang) =>
  pickName(c?.reward_label, c?.reward_label_en, lang);

// Snapshot records (WheelSpin / RewardHistory / ChallengeSubmission) store both
// names at creation time so historical rows localize without a live lookup.
export const spinRewardName = (s, lang) =>
  pickName(s?.reward_label, s?.reward_label_en, lang);

export const spinProductName = (s, lang) =>
  pickName(s?.product_name, s?.product_name_en, lang);

export const rewardHistoryName = (r, lang) =>
  pickName(r?.reward_label, r?.reward_label_en, lang);

export const rewardHistorySource = (r, lang) =>
  pickName(r?.source_name, r?.source_name_en, lang);

export const submissionChallengeName = (s, lang) =>
  pickName(s?.challenge_name, s?.challenge_name_en, lang);

// Cart / order line items snapshot both names.
export const lineItemName = (i, lang) => pickName(i?.name, i?.name_en, lang);