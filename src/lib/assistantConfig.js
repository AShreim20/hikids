// Owner-controlled assistant settings (Admin > Site Content > Assistant).
// Stored as one site_content record; read by the storefront chat to build its
// prompt. Owner answers supply the facts; promotions only bias which
// products/categories get recommended when they genuinely fit the request.
// Answers are content, not scripts: the assistant words them to fit the question.
export const ASSISTANT_CONFIG_KEY = 'assistant_config';
export const ASSISTANT_CONFIG_DEFAULT = { fixed_answers: [], promoted_categories: [], promoted_product_ids: [] };

export const isPromoted = (product, cfg) =>
  (cfg.promoted_product_ids || []).includes(product.id) || (cfg.promoted_categories || []).includes(product.category);

export function buildAssistantConfigText(cfg, lang) {
  const answers = (cfg.fixed_answers || []).filter((x) => x?.q?.trim() && (x.a?.trim() || x.a_en?.trim()));
  const parts = [];
  if (answers.length) {
    const lines = answers.map((x) => `Q: ${x.q.trim()}\nA (facts to convey): ${((lang === 'ar' ? x.a : (x.a_en || x.a)) || x.a || x.a_en).trim()}`).join('\n\n');
    parts.push(`OWNER-SET ANSWERS. When the customer's question means the same as one of these (in any wording or dialect), answer using ONLY the facts in the given answer, phrased naturally and directly for what the customer actually asked. Do not change or drop any fact, number, duration, condition or link, do not contradict it, and do not add HiKids details that are not given here or in STORE FACTS:\n${lines}`);
  }
  const hasPromo = (cfg.promoted_categories || []).length || (cfg.promoted_product_ids || []).length;
  if (hasPromo) {
    parts.push('PROMOTED items: catalog lines marked PROMOTED are store-preferred. Recommend them more often and list them first when they genuinely fit the customer\'s request (age, budget, interest, in stock). Never recommend a promoted item that does not fit, never force one, and never tell the customer it is promoted.');
  }
  return parts.join('\n\n');
}
