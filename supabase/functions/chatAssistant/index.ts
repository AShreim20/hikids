import Anthropic from 'npm:@anthropic-ai/sdk';
import { handlePreflight, json } from '../_shared/cors.ts';
import { serviceRoleClient } from '../_shared/client.ts';
import { buildSystemPrompt, type AssistantData } from '../_shared/assistantPrompt.ts';

// Powers the storefront shopping-assistant chat widget. Open to any visitor,
// including signed-out guests (public pre-sales help), so it deliberately does
// not require a caller identity.
//
// Abuse protection (this endpoint spends the store's Anthropic credit):
//  - The client can NOT influence instructions. It sends only the conversation
//    (role + text), the site language and the already-shown product ids; the
//    system prompt is built here from live database records.
//  - Strict input validation and size limits; malformed/oversized requests are
//    rejected before any database or LLM work.
//  - Server-side fixed-window rate limits (per IP and global) in Postgres via
//    assistant_rate_check(); if the limiter itself fails the request is refused
//    (fail closed) so the API key can never be exposed to unmetered use.
//
// Needs an ANTHROPIC_API_KEY secret on this project; the key is only ever read
// here and never returned to a client.

const MAX_BODY_BYTES = 40_000;
const MAX_MESSAGES = 20;
const MAX_USER_CHARS = 1000;
const MAX_ASSISTANT_CHARS = 2000;
const MAX_TOTAL_CHARS = 12_000;
const MAX_SHOWN_IDS = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Requests allowed per bucket window.
const LIMITS = [
  { scope: 'ip10m', windowSeconds: 600, limit: 15, perIp: true },
  { scope: 'ip1d', windowSeconds: 86_400, limit: 100, perIp: true },
  { scope: 'global1h', windowSeconds: 3_600, limit: 1_500, perIp: false },
] as const;

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
            // Short explanation of why this product fits. The app renders the
            // real name/price/stock/link from the database by id.
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

const MESSAGES = {
  ar: {
    rate: 'وصلت للحد الأقصى من الرسائل حاليًا. جرّب مرة ثانية بعد قليل.',
    bad: 'تعذّر معالجة رسالتك. تأكد أنها قصيرة وأعد المحاولة.',
    down: 'المساعد غير متاح حاليًا. حاول لاحقًا.',
  },
  en: {
    rate: "You've reached the message limit for now. Please try again in a little while.",
    bad: "We couldn't process your message. Please keep it short and try again.",
    down: 'The assistant is unavailable right now. Please try again later.',
  },
} as const;

function fail(status: number, code: string, lang: 'ar' | 'en', key: keyof typeof MESSAGES.ar, extra: Record<string, unknown> = {}) {
  return json({ error: code, code, message: MESSAGES[lang][key], ...extra }, { status });
}

interface ChatMessage { role: 'user' | 'assistant'; content: string }
interface ParsedRequest { messages: ChatMessage[]; lang: 'ar' | 'en'; shown: string[] }

// Returns the parsed request, or null when malformed. Unknown fields (including
// any client-supplied "system"/"prompt") are ignored.
function parseRequest(raw: unknown): ParsedRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const lang = b.lang === 'en' ? 'en' : b.lang === 'ar' ? 'ar' : null;
  if (!lang) return null;
  if (!Array.isArray(b.messages) || b.messages.length < 1 || b.messages.length > MAX_MESSAGES) return null;

  let total = 0;
  const messages: ChatMessage[] = [];
  for (const m of b.messages) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string') return null;
    const text = content.trim();
    if (!text) return null;
    if (text.length > (role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS)) return null;
    total += text.length;
    messages.push({ role, content: text });
  }
  if (total > MAX_TOTAL_CHARS) return null;
  if (messages[messages.length - 1].role !== 'user') return null;

  const shownRaw = b.shown_product_ids === undefined ? [] : b.shown_product_ids;
  if (!Array.isArray(shownRaw) || shownRaw.length > MAX_SHOWN_IDS) return null;
  const shown: string[] = [];
  for (const id of shownRaw) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) return null;
    shown.push(id);
  }
  return { messages, lang, shown };
}

// Trusted client address: Cloudflare's connecting-IP header, else the address
// appended last by the platform proxy (leftmost X-Forwarded-For entries are
// client-controlled and ignored). The global bucket bounds spend even if an
// address is spoofed.
function clientAddress(req: Request) {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Live store data used to ground the assistant (60s in-memory cache per instance).
let cache: { at: number; data: AssistantData } | null = null;
async function loadAssistantData(): Promise<AssistantData> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const db = serviceRoleClient();
  const [reasons, cities, settings, content, categories, products] = await Promise.all([
    db.from('return_reasons').select('*').eq('active', true).order('sort_order').limit(50),
    db.from('delivery_cities').select('*').eq('active', true),
    db.from('settings').select('key,value'),
    db.from('site_content').select('data').eq('key', 'assistant_config').maybeSingle(),
    db.from('categories').select('name,discount_active,discount_percent').limit(500),
    db.from('products').select('*').eq('status', 'published').order('created_date', { ascending: false }).limit(50),
  ]);
  const config = { fixed_answers: [], promoted_categories: [], promoted_product_ids: [], ...(content.data?.data || {}) };

  // Owner-promoted products outside the latest-50 window must still be recommendable.
  let productRows = products.data || [];
  const missing = (config.promoted_product_ids as string[]).filter((id) => !productRows.some((p) => p.id === id));
  if (missing.length) {
    const extra = await db.from('products').select('*').eq('status', 'published').in('id', missing.slice(0, 50));
    productRows = [...productRows, ...(extra.data || [])];
  }

  const data: AssistantData = {
    reasons: reasons.data || [],
    cities: cities.data || [],
    settings: Object.fromEntries((settings.data || []).map((r) => [r.key, r.value])),
    config,
    categories: categories.data || [],
    products: productRows,
  };
  cache = { at: Date.now(), data };
  return data;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  let lang: 'ar' | 'en' = 'ar';
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'Chat assistant is not connected yet.' }, { status: 503 });

    // Bounded read, then parse — never trust Content-Length alone.
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, 'too_large', lang, 'bad');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return fail(400, 'bad_request', lang, 'bad'); }
    const guessed = (raw as Record<string, unknown> | null)?.lang;
    if (guessed === 'en') lang = 'en';
    const parsed = parseRequest(raw);
    if (!parsed) return fail(400, 'bad_request', lang, 'bad');
    lang = parsed.lang;

    // Server-side rate limiting (fail closed).
    const ipHash = (await sha256Hex(clientAddress(req))).slice(0, 32);
    const limiter = serviceRoleClient();
    for (const l of LIMITS) {
      const { data, error } = await limiter.rpc('assistant_rate_check', {
        p_scope: l.scope,
        p_id: l.perIp ? ipHash : 'all',
        p_limit: l.limit,
        p_window_seconds: l.windowSeconds,
      });
      if (error || !data) {
        console.error('rate limiter failure', error?.message);
        return fail(503, 'unavailable', lang, 'down');
      }
      if (!data.allowed) {
        return fail(429, 'rate_limited', lang, 'rate', { retry_after: data.retry_after });
      }
    }

    const system = buildSystemPrompt(await loadAssistantData(), lang, parsed.shown);
    const convo = parsed.messages
      .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system,
      tools: [RESPOND_TOOL],
      tool_choice: { type: 'tool', name: 'respond' },
      messages: [{ role: 'user', content: `${convo}\nAssistant:` }],
    });

    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) return fail(502, 'no_reply', lang, 'down');
    return json(toolUse.input);
  } catch (error) {
    console.error('chatAssistant error', (error as Error)?.message);
    return fail(500, 'server_error', lang, 'down');
  }
});
