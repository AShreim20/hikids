import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Loader2, Sparkles, ArrowUpRight, ShoppingCart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

export default function ChatPanel({ onClose }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { addItem } = useCart();
  // Assistant messages are stored as structured objects: { text, products, showCart }.
  // The greeting starts as a plain string and is rendered gracefully below.
  const [messages, setMessages] = useState([{ role: 'assistant', content: t('ai.greeting') }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    base44.entities.Product.list('-created_date', 50)
      .then(setProducts)
      .catch(() => {});
  }, []);

  // Rich, link-bearing catalog context fed to the assistant so it can quote
  // real prices, discounts, stock, age suitability, and product ids — and
  // recommend only products that actually exist in the store. The raw URLs are
  // never shown to the customer; the UI renders short clickable links instead.
  const catalogText = products.map((p) => {
    const url = `${ORIGIN}/product/${p.id}`;
    const onSale = p.sale_price != null && Number(p.sale_price) < Number(p.price || 0);
    const price = onSale ? Number(p.sale_price) : Number(p.price || 0);
    const discount = onSale ? Math.round((1 - p.sale_price / p.price) * 100) : 0;
    const stock = Number(p.stock ?? 0);
    return `ID:${p.id} | ${p.name} | ${p.category || ''} | ages ${p.age_range || 'all'} | price ₪${price}${onSale ? ` (was ₪${p.price}, -${discount}%)` : ''} | stock ${stock}${stock <= 0 ? ' OUT OF STOCK' : ''} | url ${p.url || url}`;
  }).join('\n');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const sys = `You are the HiKids toy store personal shopping assistant. Help customers choose toys and answer questions about ages, categories, pricing, discounts, shipping, loyalty points, returns, and payment (card or cash on delivery). Be friendly, warm and concise. Reply in ${ar ? 'Arabic' : 'English'}.

When you mention, recommend, or discuss any product, include an entry in the "products" array with that product's id, name, and url. Do NOT write raw URLs in the reply text — the app renders clean clickable "View Product" links for the customer from the products array. Just refer to products by name in the reply.

Include the current price, and if a product is discounted include the original price and the discount percentage. Mention stock status (in stock / out of stock), age suitability, and category when relevant.

You can recommend suitable REAL products from the catalog for a given need (for example "a gift for a 6-year-old"). Only recommend products that exist in the catalog provided — never invent products, prices, discounts, or availability. For each recommendation give the product name, price, discount if any, and a short reason it is suitable (the link is added automatically).

You can add a product to the customer's cart when they explicitly request it (for example "add this to my cart", "أضفه للسلة", "add it"). Put the product id and quantity in the add_to_cart array and the app will add it and show a View Cart link. Still write a natural reply telling them what you added.

If asked about a specific order's status, tell them to use the Order Tracking page.

Current product catalog (ID | name | category | ages | price | stock | url):\n${catalogText || 'Loading catalog...'}`;
      const convo = next.map((m) => {
        const c = typeof m.content === 'string' ? m.content : m.content.text;
        return `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${c}`;
      }).join('\n');
      const schema = {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                url: { type: 'string' },
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
      };
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `${sys}\n\n${convo}\nAssistant:`,
        response_json_schema: schema,
      });
      let data = res;
      if (typeof res === 'string') {
        try { data = JSON.parse(res); } catch { data = { reply: res }; }
      }
      data = data || {};
      // Strip any stray raw URLs from the reply as a safety net — links are
      // rendered from the products array instead.
      let reply = (data.reply || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
      const actions = Array.isArray(data.add_to_cart) ? data.add_to_cart : [];
      const mentioned = Array.isArray(data.products) ? data.products : [];
      const added = [];
      for (const a of actions) {
        const p = products.find((x) => x.id === a.product_id);
        if (!p) continue;
        const qty = Math.max(1, parseInt(a.qty, 10) || 1);
        addItem(p, qty);
        added.push(`${p.name} × ${qty}`);
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

  return (
    <div className="fixed z-50 inset-x-2 bottom-[9.5rem] md:inset-x-auto md:start-6 md:bottom-24 md:w-[24rem] h-[min(78vh,34rem)] md:h-[60vh] md:max-h-[32rem] rounded-3xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden float-in">
      <div className="flex items-center gap-3 px-4 py-3 bg-cosmic text-white">
        <Sparkles className="w-5 h-5" />
        <div>
          <p className="font-heading font-bold leading-none">{t('ai.title')}</p>
          <p className="text-xs text-white/70 mt-0.5">{t('ai.subtitle')}</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3 bg-mist/40">
        {messages.map((m, i) => {
          const isStr = typeof m.content === 'string';
          const text = isStr ? m.content : (m.content.text || '');
          const links = isStr ? [] : (m.content.products || []);
          const showCart = !isStr && m.content.showCart;
          return (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-cosmic text-white rounded-br-md' : 'bg-card border border-border rounded-bl-md'}`}>
                {text}
              </div>
              {links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 max-w-[90%]">
                  {links.map((p) => {
                    const path = `/product/${p.id}`;
                    return (
                      <Link
                        key={p.id}
                        to={path}
                        onClick={() => typeof onClose === 'function' && onClose()}
                        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-cosmic/10 text-cosmic border border-cosmic/20 font-heading font-bold text-xs hover:bg-cosmic hover:text-white transition-colors"
                      >
                        {p.name} <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    );
                  })}
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