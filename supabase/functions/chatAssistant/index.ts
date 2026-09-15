import Anthropic from 'npm:@anthropic-ai/sdk';
import { handlePreflight, json } from '../_shared/cors.ts';

// Powers the storefront shopping-assistant chat widget — replaces Base44's
// base44.integrations.Core.InvokeLLM. Open to any visitor, including signed-
// out guests (the original widget had no auth gate either — it's public
// pre-sales help, not account-specific), so this deliberately does not
// require a caller identity the way the admin-only functions do.
//
// Needs an ANTHROPIC_API_KEY secret set on this project
// (`supabase secrets set ANTHROPIC_API_KEY=...`) before it can actually
// answer; until then it returns a clear "not connected" error so the widget
// can show a friendly message instead of crashing. This is a genuinely new
// external credential — an Anthropic API key — that only the store owner
// can supply; nothing here can substitute for it.
//
// Structured output is done by forcing tool_choice at a single "respond"
// tool whose input_schema matches what the client expects (reply text, plus
// optional product mentions / add_to_cart actions) — the documented way to
// get shaped JSON out of the Messages API, mirroring the
// response_json_schema behavior Base44's InvokeLLM offered.
const RESPOND_TOOL: Anthropic.Tool = {
  name: 'respond',
  description: 'Send the reply to the customer.',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            // A short (roughly one sentence) explanation of why this
            // specific product fits the customer's request — the only part
            // of a product recommendation the assistant actually writes.
            // The app looks up the live product record by id and renders
            // its own name/price/discount/stock/link from the database, so
            // this must never restate any of those.
            reason: { type: 'string' },
          },
          required: ['id'],
        },
      },
      add_to_cart: {
        type: 'array',
        items: {
          type: 'object',
          properties: { product_id: { type: 'string' }, qty: { type: 'integer' } },
          required: ['product_id'],
        },
      },
    },
    required: ['reply'],
  },
};

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json({ error: 'Chat assistant is not connected yet.' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const system = String(body.system || '');
    const prompt = String(body.prompt || '');
    if (!prompt) return json({ error: 'prompt required' }, { status: 400 });

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system,
      tools: [RESPOND_TOOL],
      tool_choice: { type: 'tool', name: 'respond' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) return json({ error: 'No structured reply from the assistant.' }, { status: 502 });

    return json(toolUse.input);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
