import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { variantLabel } from '@/lib/variants';
import { useLanguage } from '@/context/LanguageContext';
import { gaEvent, GA_CURRENCY } from '@/lib/ga4';
import { cartLineToGAItem } from '@/lib/ga4Items';

const CartContext = createContext(null);
const STORAGE_KEY = 'hikids_cart_v1';

export function CartProvider({ children }) {
  const { lang } = useLanguage();
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { /* ignore */ }
  }, [items]);

  // The cart is device-local storage, not scoped to a signed-in user, so a
  // signed-out browser handed to (or shared by) a different customer must
  // never show whoever was last signed in here their cart. Cleared on actual
  // sign-out, not merely on losing tab focus — a guest cart built before
  // logging in is untouched, and nothing here reacts to a background token
  // refresh (see AuthContext's stable-user-reference fix), only a real
  // SIGNED_OUT event.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setItems([]);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Which cart lines the customer chose to check out (a Set of lineIds).
  // Set from the Cart page right before navigating to checkout; null means
  // "no filter chosen" (e.g. a direct visit) — Checkout then uses the whole
  // cart. Lives in memory only; it is not persisted and clears after the order.
  const [checkoutSelection, setCheckoutSelection] = useState(null);

  // Fires the matching GA4 cart event for ONE real, already-computed quantity
  // change — never for an unrelated rerender or a call that ended up adding/
  // removing nothing (every call site below only invokes this with a genuine
  // qty delta already confirmed > 0).
  const fireCartEvent = (name, line, qty) => {
    if (qty <= 0) return;
    const item = cartLineToGAItem({ ...line, qty }, lang);
    if (!item) return;
    gaEvent(name, { currency: GA_CURRENCY, value: Math.round(item.price * qty * 100) / 100, items: [item] });
  };

  // `variant` (optional) is the selected variant combination — its exact
  // details are snapshotted into the cart line so later product edits don't
  // change what was bought.
  const addItem = (product, qty = 1, variant = null, price = null) => {
    const lineId = variant ? `${product.id}::${variant.key}` : product.id;
    // Never let a cart line exceed available stock. Variant stock wins over
    // product stock; missing stock info is treated as unlimited.
    const available =
      variant && variant.stock != null ? Number(variant.stock)
      : product.stock != null ? Number(product.stock)
      : Infinity;
    const max = Number.isFinite(available) ? Math.max(0, available) : Infinity;
    const existing = items.find((i) => i.lineId === lineId);
    const before = existing ? existing.qty : 0;
    const desired = before + qty;
    const finalQty = Number.isFinite(max) ? Math.min(desired, max) : desired;
    const capped = finalQty < desired;
    setItems((prev) => {
      const ex = prev.find((i) => i.lineId === lineId);
      if (ex) {
        if (finalQty < 1) return prev;
        return prev.map((i) =>
          i.lineId === lineId
            ? { ...i, qty: finalQty, ...(Number.isFinite(available) ? { stock: available } : {}) }
            : i
        );
      }
      if (finalQty < 1) return prev;
      return [
        ...prev,
        {
          lineId,
          id: product.id,
          product_code: product.product_code || null,
          name: product.name,
          name_en: product.name_en || '',
          price: price != null ? price : (product.sale_price ?? product.price),
          image_url: product.image_url,
          qty: finalQty,
          ...(Number.isFinite(available) ? { stock: available } : {}),
          variant_key: variant?.key || null,
          variant_label: variant ? variantLabel(variant.attributes) : null,
          variant_attributes: variant?.attributes || null,
          sku: variant?.sku || null,
        },
      ];
    });
    const added = Math.max(0, finalQty - before);
    fireCartEvent('add_to_cart', {
      product_code: product.product_code, id: product.id, name: product.name, name_en: product.name_en,
      price: price != null ? price : (product.sale_price ?? product.price),
      variant_label: variant ? variantLabel(variant.attributes) : null,
    }, added);
    return { added, available: Number.isFinite(available) ? available : null, requested: qty, capped, finalQty };
  };

  // A bundle is one purchasable package from the customer's perspective.
  // Internally the cart keeps the component products (with their quantities)
  // so the order can deduct component inventory on completion.
  //
  // `available` is the caller's already-computed bundleAvailability() (how
  // many complete bundles current component stock can assemble) — stored on
  // the line as `stock`, the same field addItem() uses, so the cart's own
  // existing +/- stepper (updateQty, unchanged) caps a bundle line exactly
  // like a product line instead of letting it grow unbounded. Without this,
  // a customer could increment a bundle's cart quantity past what its
  // components could ever fulfill (still safely rejected at checkout by
  // commit_order_stock's row-locked stock check, but confusingly late).
  const addBundle = (bundle, qty = 1, price, components, available = null) => {
    const lineId = `bundle::${bundle.id}`;
    const max = Number.isFinite(available) ? Math.max(0, available) : Infinity;
    const before = items.find((i) => i.lineId === lineId)?.qty || 0;
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        const finalQty = Number.isFinite(max) ? Math.min(existing.qty + qty, max) : existing.qty + qty;
        return prev.map((i) =>
          i.lineId === lineId
            ? { ...i, qty: finalQty, ...(Number.isFinite(max) ? { stock: max } : {}) }
            : i
        );
      }
      const finalQty = Number.isFinite(max) ? Math.min(qty, max) : qty;
      if (finalQty < 1) return prev;
      return [
        ...prev,
        {
          lineId,
          id: bundle.id,
          bundle_id: bundle.id,
          is_bundle: true,
          name: bundle.name,
          name_en: bundle.name_en,
          price,
          image_url: bundle.image_url,
          qty: finalQty,
          ...(Number.isFinite(max) ? { stock: max } : {}),
          bundle_items: components,
        },
      ];
    });
    const finalQty = Number.isFinite(max) ? Math.min(before + qty, max) : before + qty;
    fireCartEvent('add_to_cart', {
      bundle_id: bundle.id, id: bundle.id, name: bundle.name, name_en: bundle.name_en, price, is_bundle: true,
    }, Math.max(0, finalQty - before));
  };

  const removeItem = (lineId) => {
    const line = items.find((i) => (i.lineId || i.id) === lineId);
    setItems((prev) => prev.filter((i) => (i.lineId || i.id) !== lineId));
    if (line) fireCartEvent('remove_from_cart', line, line.qty);
  };

  // Bulk-remove several cart lines at once (by their lineId). Used by the
  // cart's "Delete Selected" action — lines not in the set are left intact.
  // NOT used for the "order placed" cleanup in Checkout.jsx: those lines were
  // purchased, not removed, so that call site skips this analytics path (see
  // the dedicated `purchase` event fired there instead).
  const removeItems = (lineIds, { trackRemoval = true } = {}) => {
    const set = new Set(lineIds);
    if (set.size === 0) return;
    const removed = trackRemoval ? items.filter((i) => set.has(i.lineId || i.id)) : [];
    setItems((prev) => prev.filter((i) => !set.has(i.lineId || i.id)));
    if (trackRemoval && removed.length) {
      const gaItems = removed.map((line) => cartLineToGAItem(line, lang)).filter(Boolean);
      if (gaItems.length) {
        gaEvent('remove_from_cart', {
          currency: GA_CURRENCY,
          value: Math.round(gaItems.reduce((s, it) => s + it.price * it.quantity, 0) * 100) / 100,
          items: gaItems,
        });
      }
    }
  };

  const updateQty = (lineId, qty) => {
    const line = items.find((i) => (i.lineId || i.id) === lineId);
    const max = line && typeof line.stock === 'number' && Number.isFinite(line.stock) ? line.stock : Infinity;
    // A free wheel reward is exactly one unit -- never adjustable.
    if (line?.is_wheel_reward) return { capped: false, available: null, finalQty: 1 };
    const finalQty = Number.isFinite(max) ? Math.min(Math.max(1, qty), Math.max(1, max)) : Math.max(1, qty);
    const capped = Number.isFinite(max) && qty > max;
    setItems((prev) =>
      prev.map((i) => ((i.lineId || i.id) === lineId ? { ...i, qty: finalQty } : i))
    );
    // A quantity STEP (the cart's +/- stepper) is real cart behavior too —
    // GA4's own recommendation is add_to_cart for an increase and
    // remove_from_cart for a decrease, each for just the delta, never the
    // new total (which would double-count the units already tracked when
    // the line was first added).
    if (line) {
      const delta = finalQty - line.qty;
      if (delta > 0) fireCartEvent('add_to_cart', line, delta);
      else if (delta < 0) fireCartEvent('remove_from_cart', line, -delta);
    }
    return { capped, available: Number.isFinite(max) ? max : null, finalQty };
  };

  // A free Mystery Wheel product reward. price is 0 (100% discount) but the
  // product's normal price is snapshotted as `reward_price` so the server can
  // re-price the line if the same reward is ever redeemed twice. One line per
  // spin (lineId keyed on the spin id) — the same reward can't be added twice.
  const addWheelReward = (product, spinId, rewardPrice) => {
    const lineId = `wheel::${spinId}`;
    setItems((prev) => {
      if (prev.some((i) => i.lineId === lineId)) return prev;
      return [...prev, { lineId, id: product.id, name: `${product.name} · Free Mystery Wheel reward`, price: 0, image_url: product.image_url, qty: 1, wheel_spin_id: spinId, is_wheel_reward: true, reward_price: rewardPrice || 0 }];
    });
  };

  const clear = () => setItems([]);

  // Re-read current inventory for every cart line and adjust quantities that
  // now exceed available stock (or remove lines that sold out). Returns the
  // list of adjustments so the caller can inform the customer. Bundles and
  // lines without a product id are skipped here — the atomic checkout check
  // still catches them.
  const revalidateStock = async () => {
    if (items.length === 0) return [];
    const ids = Array.from(new Set(items.filter((i) => i.id && !i.is_bundle).map((i) => i.id)));
    if (ids.length === 0) return [];
    const products = await Promise.all(ids.map((id) => db.Product.get(id).catch(() => null)));
    const map = {};
    products.forEach((p) => { if (p) map[p.id] = p; });
    const adjustments = [];
    // Out-of-stock lines are KEPT in the cart but flagged `unavailable: true`
    // so the UI can grey them out and checkout can skip them — they are never
    // silently deleted. If stock returns later, revalidation flips the flag
    // back off so the line becomes purchasable again.
    const next = items.map((i) => {
      if (i.is_bundle || !i.id) return i;
      const p = map[i.id];
      // No longer readable — deleted, or unpublished (RLS hides a draft from
      // this anon/customer read exactly like a delete would). Either way the
      // product can no longer be bought, so flag it unavailable instead of
      // silently leaving the line untouched. Pushed into `adjustments` (not
      // just returned) so the `setItems` below actually applies the change —
      // otherwise a line that was previously available would flip
      // `unavailable` in the returned array but that array is discarded
      // whenever `adjustments` stays empty.
      if (!p) {
        if (!i.unavailable) adjustments.push({ id: i.id, name: i.name, variant_label: i.variant_label || null, oldQty: i.qty, newQty: 0, available: 0 });
        return { ...i, unavailable: true, stock: 0 };
      }
      let available;
      if (i.variant_key && Array.isArray(p.variants)) {
        const v = p.variants.find((x) => x && x.key === i.variant_key);
        available = v ? Number(v.stock ?? 0) : 0;
      } else {
        available = p.stock != null ? Number(p.stock) : Infinity;
      }
      if (!Number.isFinite(available)) return { ...i, unavailable: false }; // unlimited
      if (i.qty > available) {
        const newQty = Math.max(0, available);
        adjustments.push({ id: i.id, name: i.name, variant_label: i.variant_label || null, oldQty: i.qty, newQty, available });
        if (newQty <= 0) return { ...i, unavailable: true, stock: 0 };
        return { ...i, qty: newQty, stock: available, unavailable: false };
      }
      return { ...i, stock: available, unavailable: false };
    });
    if (adjustments.length > 0) setItems(next);
    return adjustments;
  };

  // Apply a backend "insufficient" list (from commitOrderStock) directly —
  // caps each affected line to its real available quantity, removing lines
  // that are now out of stock. Returns the adjustments for messaging.
  const adjustForInsufficient = (insufficient) => {
    if (!Array.isArray(insufficient) || insufficient.length === 0) return [];
    const adjustments = [];
    const next = items.map((i) => {
      const match = insufficient.find((s) => s.id === i.id && (s.variant_key || null) === (i.variant_key || null));
      if (!match) return i;
      const newQty = Math.max(0, Number(match.available || 0));
      adjustments.push({ id: i.id, name: i.name, variant_label: i.variant_label || null, oldQty: i.qty, newQty, available: match.available });
      if (newQty <= 0) return { ...i, unavailable: true, stock: 0 };
      return { ...i, qty: newQty, stock: newQty, unavailable: false };
    });
    setItems(next);
    return adjustments;
  };

  const count = items.reduce((s, i) => s + i.qty, 0);
  // Unavailable (out-of-stock) lines are kept in the cart but excluded from
  // the purchasable total — the customer is never charged for them.
  const total = items.reduce((s, i) => s + (i.unavailable ? 0 : i.qty * i.price), 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, addBundle, addWheelReward, removeItem, removeItems, updateQty, clear, count, total, revalidateStock, adjustForInsufficient, checkoutSelection, setCheckoutSelection }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);