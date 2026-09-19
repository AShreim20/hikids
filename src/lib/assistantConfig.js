// Owner-controlled assistant settings (Admin > Site Content > Assistant).
// Stored as one site_content record; read by the storefront chat to build its
// prompt. Fixed answers are quoted as written; promotions only bias which
// products/categories get recommended when they genuinely fit the request.
export const ASSISTANT_CONFIG_KEY = 'assistant_config';
export const ASSISTANT_CONFIG_DEFAULT = { fixed_answers: [], promoted_categories: [], promoted_product_ids: [] };

export const isPromoted = (product, cfg) =>
  (cfg.promoted_product_ids || []).includes(product.id) || (cfg.promoted_categories || []).includes(product.category);

export function buildAssistantConfigText(cfg, lang) {
  const answers = (cfg.fixed_answers || []).filter((x) => x?.q?.trim() && (x.a?.trim() || x.a_en?.trim()));
  const parts = [];
  if (answers.length) {
    const lines = answers.map((x) => `Q: ${x.q.trim()}\nA (use exactly): ${((lang === 'ar' ? x.a : (x.a_en || x.a)) || x.a || x.a_en).trim()}`).join('\n\n');
    parts.push(`FIXED ANSWERS (set by the store owner). When the customer's question matches one of these, reply with the given answer exactly as written — do not rephrase, extend, shorten, or contradict it:\n${lines}`);
  }
  const hasPromo = (cfg.promoted_categories || []).length || (cfg.promoted_product_ids || []).length;
  if (hasPromo) {
    parts.push('PROMOTED items: catalog lines marked PROMOTED are store-preferred. Recommend them more often and list them first when they genuinely fit the customer\'s request (age, budget, interest, in stock). Never recommend a promoted item that does not fit, never force one, and never tell the customer it is promoted.');
  }
  return parts.join('\n\n');
}
