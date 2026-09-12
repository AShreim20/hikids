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
  const scrollRef = useRef(null);

  useEffect(() => {
    db.Product.list('-created_date', 50)
      .then(setProducts)
      .catch(() => {});
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
    try {
      const sys = `You are the HiKids toy store personal shopping assistant. Help customers choose toys and answer questions about ages, categories, pricing, discounts, shipping, loyalty points, returns, and payment (card or cash on delivery). Be warm, friendly and concise — sound like a helpful person, not a database dump.

LANGUAGE: Reply entirely in ${ar ? 'Arabic' : 'English'} — the customer's current site language. Never mix the two languages in the same reply${ar ? '. Do not include English product names unless the customer explicitly asks for them' : ', using the English product name when one exists'}.

FORMATTING: Keep the conversational part short — one or two sentences introducing what you found, and optionally one short closing sentence at the end (for example, offering to narrow the search further by category). You may use **bold**, short paragraphs, or lists for general questions (shipping, policies, loyalty, etc.), but when recommending products:
- Do NOT list product names, prices, discounts, or stock status in the reply text — the app renders each recommended product as its own card directly below your message, straight from the database.
- Do NOT write a numbered or bulleted list of products in the reply.
- Refer to them only generically ("a few options below", "some picks that fit").

PRODUCTS: For every product you recommend or specifically discuss, add one entry to the "products" array with that product's id and a short one-sentence "reason" it fits — never its price, discount, or stock; the card already shows the real, current data for that. Only use ids that exist in the catalog below — never invent a product, price, discount, or availability. Prefer your best 3-6 matches rather than every possible option.

CART: You can add a product to the customer's cart when they explicitly ask (for example "add this to my cart", "أضفه للسلة", "add it"). Put the product id and quantity in the add_to_cart array and the app will add it and show a View Cart link. Still write a short natural reply confirming what you added.

If asked about a specific order's status, tell them to use the Order Tracking page.

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
      // A hard cap here is just a safety net against the model ignoring the
      // "3-6 matches" guidance; the actual initial on-screen count is
      // smaller still (INITIAL_PRODUCT_LIMIT, applied at render time).
      const mentioned = (Array.isArray(data.products) ? data.products : []).slice(0, 8);
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
            icon — a small white circle behind it keeps it readable against
            the purple header regardless of the logo art's own colors, while
            the <img> itself keeps its natural proportions (only its height
            is constrained). */}
        <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-white/95 overflow-hidden shadow-sm">
          <Logo className="h-6 w-auto" />
        </span>
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