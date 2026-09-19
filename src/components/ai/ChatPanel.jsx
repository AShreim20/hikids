import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Loader2, ArrowUpRight, ShoppingCart, X } from 'lucide-react';
import { db } from '@/api/entities';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { useCart } from '@/context/CartContext';
import { useFloatingOffset } from '@/hooks/useFloatingOffset';
import { priceInfo } from '@/lib/pricing';
import { productName } from '@/lib/bilingual';
import { detectTextDir } from '@/lib/textDirection';
import { buildStoreFacts } from '@/lib/assistantPolicy';
import Logo from '@/components/Logo';
import ChatMarkdown from './ChatMarkdown';
import ChatProductCard from './ChatProductCard';

// Products are shown as individual cards (see ChatProductCard) rather than
// a growing wall of results — an initial page of the assistant's best
// matches, with the rest revealed on demand.
const INITIAL_PRODUCT_LIMIT = 4;

export default function ChatPanel({ onClose }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { addItem } = useCart();
  const { discountPctFor } = useCategories();
  // Which messages have had their product cards expanded past the initial
  // limit — local UI state only, deliberately not persisted with the
  // conversation (a reload starts collapsed again, same as any "show more").
  const [expandedMap, setExpandedMap] = useState({});
  // Assistant messages are stored as structured objects: { text, products, showCart }.
  // The greeting starts as a plain string and is rendered gracefully below.
  const STORAGE_KEY = 'hikids_chat_v1';
  const TTL_MS = 60 * 60 * 1000; // conversation kept for 1 hour after last activity
  const lastActivityRef = useRef(Date.now());

  // Restore an in-window conversation (persists across navigation/refresh);
  // expire anything older than 1 hour of inactivity.
  const loadChat = () => {
    const fresh = [{ role: 'assistant', content: t('ai.greeting') }];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.messages)) return fresh;
      if (Date.now() - (parsed.ts || 0) > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return fresh;
      }
      lastActivityRef.current = parsed.ts || Date.now();
      return parsed.messages;
    } catch {
      return fresh;
    }
  };
  const [messages, setMessages] = useState(loadChat);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState([]);
  // Live policy sources for the assistant's STORE FACTS (never hardcoded).
  const [policy, setPolicy] = useState({ reasons: [], cities: [], settings: {} });
  const scrollRef = useRef(null);

  useEffect(() => {
    db.Product.list('-created_date', 50)
      .then(setProducts)
      .catch(() => {});
    Promise.all([
      db.ReturnReason.filter({ active: true }, 'sort_order', 50).catch(() => []),
      db.DeliveryCity.filter({ active: true }).catch(() => []),
      db.Setting.list().catch(() => []),
    ]).then(([reasons, cities, rows]) => {
      setPolicy({ reasons: reasons || [], cities: cities || [], settings: Object.fromEntries((rows || []).map((r) => [r.key, r.value])) });
    });
  }, []);

  // Catalog context fed to the assistant so it can reason about real
  // prices, discounts, stock and age suitability, and recommend only
  // products that actually exist in the store — using the exact same
  // pricing helper (priceInfo + discountPctFor) the storefront's own
  // ProductCard uses, so a category-level discount is reflected here too
  // (a plain sale_price check would silently miss it). The app never shows
  // this text to the customer, and never trusts anything the assistant
  // says about price/discount/stock for display — see ChatProductCard.
  const catalogText = products.map((p) => {
    const { final, original, hasDiscount, discountPct } = priceInfo(p, discountPctFor(p.category));
    const stock = Number(p.stock ?? 0);
    return `ID:${p.id} | ${productName(p, lang)} | ${p.category || ''} | ages ${p.age_range || 'all'} | price ₪${final}${hasDiscount ? ` (was ₪${original}, -${discountPct}%)` : ''} | stock ${stock}${stock <= 0 ? ' OUT OF STOCK' : ''}`;
  }).join('\n');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Persist the conversation with the last-activity timestamp. Navigation,
  // refresh, or opening a product link never touches lastActivity — only
  // sending a message does — so the 1-hour idle window is preserved.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, ts: lastActivityRef.current }));
    } catch { /* ignore */ }
  }, [messages]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    lastActivityRef.current = Date.now(); // user interaction resets the 1h idle timer
    // Every product id already shown anywhere in this conversation so far —
    // handed to the assistant as the "avoid repeating" list for a "غيرهم/
    // كمان" follow-up (see RECOMMENDATION COUNT below). Derived straight
    // from the existing message history (already persisted with the chat),
    // so no extra state needs to be tracked or reset by hand — the prompt
    // itself tells the model to ignore this list once the customer starts a
    // genuinely new search.
    const shownProductIds = [...new Set(
      messages.flatMap((m) =>
        typeof m.content === 'object' && Array.isArray(m.content.products)
          ? m.content.products.map((p) => p.id)
          : []
      )
    )];
    try {
      const sys = `You are the HiKids toy store personal shopping assistant. Help customers choose toys and answer questions about ages, categories and product pricing/discounts/availability from the catalog below. For any HiKids policy or business rule (returns, exchanges, delivery, payments, loyalty points, Wallet, Mystery Wheel, orders) rely ONLY on the STORE FACTS below. Be warm, friendly and concise — sound like a helpful person, not a database dump.

LANGUAGE: Reply entirely in ${ar ? 'Arabic' : 'English'} — the customer's current site language. Never mix the two languages in the same reply${ar ? '. Do not include English product names unless the customer explicitly asks for them' : ', using the English product name when one exists'}.

FORMATTING: Keep the conversational part short — one or two sentences introducing what you found, and optionally one short closing sentence at the end (for example, offering to narrow the search further by category). You may use **bold**, short paragraphs, or lists for general questions (shipping, policies, loyalty, etc.), but when recommending products:
- Do NOT list product names, prices, discounts, or stock status in the reply text — the app renders each recommended product as its own card directly below your message, straight from the database.
- Do NOT write a numbered or bulleted list of products in the reply.
- Refer to them only generically ("a few options below", "some picks that fit").

PRODUCTS: For every product you recommend or specifically discuss, add one entry to the "products" array with that product's id and a short one-sentence "reason" it fits — never its price, discount, or stock; the card already shows the real, current data for that. Only use ids that exist in the catalog below — never invent a product, price, discount, or availability. Exactly how many to include is set by RECOMMENDATION COUNT below.

RECOMMENDATION COUNT: By default, recommend exactly 3 products — never more, even when many products match. If the customer explicitly asks for a specific number (for example "اعطيني خيارين" = 2, "اعطيني 5 خيارات" = 5, "خيار واحد" = 1, "three options"), recommend exactly that many instead, but never more than 6 in a single response even if they ask for more or for the whole catalog ("كل المنتجات"). If they ask for everything or an unreasonably large number, pick your best 3-6 matches and mention in the reply, in words only (no link), that they can browse the full Shop page for more.

MORE OPTIONS: If the customer asks to see other options for the SAME request (e.g. "غيرهم", "كمان", "خيارات ثانية", "ورجيني غيرهم", "في غيرهم؟", "عروض ثانية", "show me more", "other options"), keep the same filters as that request (age, gender, category, budget, etc.) and recommend DIFFERENT products than every id listed under "Already shown" below — never repeat one of them unless there are truly no other matching products left, in which case say so naturally instead of repeating or inventing products. If instead the customer's newest message describes a new or different search (different age, gender, category, or budget than before), treat it as a brand-new recommendation and ignore the "Already shown" list — pick freely from the full catalog again.

Already shown this conversation (avoid repeating for a "more options" request): ${shownProductIds.length ? shownProductIds.join(', ') : 'none yet'}

CART: You can add a product to the customer's cart when they explicitly ask (for example "add this to my cart", "أضفه للسلة", "add it"). Put the product id and quantity in the add_to_cart array and the app will add it and show a View Cart link. Still write a short natural reply confirming what you added.

If asked about a specific order's status, tell them to open My Orders (/orders).

${buildStoreFacts({ ...policy, lang })}

Current product catalog (ID | name | category | ages | price | stock):\n${catalogText || 'Loading catalog...'}`;
      const convo = next.map((m) => {
        const c = typeof m.content === 'string' ? m.content : m.content.text;
        return `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${c}`;
      }).join('\n');
      const data = (await invokeFunction('chatAssistant', {
        system: sys,
        prompt: `${convo}\nAssistant:`,
      })) || {};
      // Strip any stray raw URLs from the reply as a safety net — links are
      // rendered from the products array instead.
      let reply = (data.reply || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
      const actions = Array.isArray(data.add_to_cart) ? data.add_to_cart : [];
      // { id, reason } entries only — every other displayed field (name,
      // price, discount, stock, link) is resolved from the live `products`
      // catalog by id when rendering, never from what the assistant wrote.
      // This slice is the actual hard ceiling from RECOMMENDATION COUNT
      // above (never more than 6 per response) — a safety net in case the
      // model ignores that instruction, not the primary way the count is
      // controlled. The initial on-screen count is smaller still
      // (INITIAL_PRODUCT_LIMIT, applied at render time).
      const mentioned = (Array.isArray(data.products) ? data.products : []).slice(0, 6);
      const added = [];
      for (const a of actions) {
        const p = products.find((x) => x.id === a.product_id);
        if (!p) continue;
        const qty = Math.max(1, parseInt(a.qty, 10) || 1);
        addItem(p, qty);
        added.push(`${productName(p, lang)} × ${qty}`);
      }
      if (added.length) {
        const note = ar
          ? `تمت إضافة ${added.join('، ')} إلى سلة المشتريات.`
          : `Added ${added.join(', ')} to your cart.`;
        reply = `${reply}\n\n🛒 ${note}`;
      }
      setMessages((m) => [...m, {
        role: 'assistant',
        content: { text: reply, products: mentioned, showCart: added.length > 0 },
      }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: t('ai.error') }]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [t('ai.sugg1'), t('ai.sugg2'), t('ai.sugg3')];
  // Anchored at the same slot the collapsed button occupies (it's hidden
  // while the panel is open, so this is exactly "opening in its place") —
  // clears the mobile bottom nav / desktop margin / device safe area / the
  // current page's sticky purchase bar height, all in one shared formula
  // instead of a hard-coded offset. --chat-bottom feeds the CSS max-height
  // calc below (see .chat-panel-height in index.css) so the panel's own
  // height always fits above whatever it's anchored above, even on a short
  // laptop screen.
  const { bottom, bottomPx } = useFloatingOffset(0);

  return (
    <div
      className="fixed z-[60] inset-x-2 md:inset-x-auto md:start-6 md:w-[24rem] rounded-3xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden float-in chat-panel-height"
      style={{ bottom, '--chat-bottom': `${bottomPx}px` }}
      role="dialog"
      aria-label={t('ai.title')}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-cosmic text-white shrink-0">
        {/* Official HiKids logo (the same asset Navbar uses), not a redrawn
            icon, shown directly on the purple header — no circular badge or
            background. Width is fixed (~56px, within the requested 52-65px
            range) and height is auto, so the logo's own aspect ratio is
            preserved with no cropping; object-contain is redundant with
            that (an unconstrained auto height never crops) but kept
            explicit per spec. `shrink-0` keeps it from being squeezed by
            the title/subtitle on narrow screens. */}
        <Logo className="shrink-0 w-14 h-auto object-contain" />
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold leading-none truncate">{t('ai.title')}</p>
          <p className="text-xs text-white/70 mt-0.5 truncate">{t('ai.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={ar ? 'إغلاق' : 'Close'}
          className="shrink-0 squish grid place-items-center w-8 h-8 rounded-full hover:bg-white/15 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3 bg-mist/40">
        {messages.map((m, i) => {
          const isStr = typeof m.content === 'string';
          const text = isStr ? m.content : (m.content.text || '');
          const mentioned = isStr ? [] : (m.content.products || []);
          const showCart = !isStr && m.content.showCart;
          const dir = detectTextDir(text);
          // Resolve each { id, reason } the assistant sent against the live
          // catalog — an id that doesn't (or no longer) match a real
          // product is simply dropped rather than shown with blank/guessed
          // data (see ChatProductCard for why every other field always
          // comes from this record, never from the assistant).
          const resolved = mentioned
            .map((r) => ({ product: products.find((p) => p.id === r.id), reason: r.reason }))
            .filter((r) => r.product);
          const expanded = !!expandedMap[i];
          const visible = expanded ? resolved : resolved.slice(0, INITIAL_PRODUCT_LIMIT);
          const hasMore = resolved.length > visible.length;
          return (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                dir={dir}
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm break-words ${m.role === 'user' ? 'bg-cosmic text-white rounded-br-md' : 'bg-card border border-border rounded-bl-md'}`}
              >
                {isStr ? (
                  <span className="whitespace-pre-wrap leading-relaxed">{text}</span>
                ) : (
                  <ChatMarkdown text={text} />
                )}
              </div>
              {visible.length > 0 && (
                <div className="mt-2 w-full max-w-[92%] space-y-2">
                  {visible.map(({ product, reason }) => (
                    <ChatProductCard key={product.id} product={product} reason={reason} onNavigate={onClose} />
                  ))}
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setExpandedMap((s) => ({ ...s, [i]: true }))}
                      className="w-full text-center text-xs font-heading font-bold text-cosmic hover:underline py-1"
                    >
                      {t('ai.showMore')}
                    </button>
                  )}
                </div>
              )}
              {showCart && (
                <Link
                  to="/cart"
                  onClick={() => typeof onClose === 'function' && onClose()}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-accent/10 text-accent border border-accent/30 font-heading font-bold text-xs hover:bg-accent hover:text-white transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> {ar ? 'عرض السلة' : 'View Cart'} <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          );
        })}
        {busy &&
        <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl bg-card border border-border"><Loader2 className="w-4 h-4 animate-spin text-cosmic" /></div>
          </div>
        }
      </div>
      {messages.length <= 1 &&
      <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestions.map((s) =>
        <button key={s} type="button" onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full bg-mist border border-border hover:border-cosmic">{s}</button>
        )}
        </div>
      }
      <form onSubmit={(e) => {e.preventDefault();send(input);}} className="p-3 border-t border-border flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('ai.placeholder')} className="flex-1 h-11 px-4 rounded-full bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
        <button type="submit" disabled={busy} className="grid place-items-center w-11 h-11 rounded-full bg-cosmic text-white disabled:opacity-60"><Send className="w-4 h-4" /></button>
      </form>
    </div>);

}