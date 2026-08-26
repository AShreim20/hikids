import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { variantLabel } from '@/lib/variants';

const CartContext = createContext(null);
const STORAGE_KEY = 'hikids_cart_v1';

export function CartProvider({ children }) {
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
          name: product.name,
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
    return { added: Math.max(0, finalQty - before), available: Number.isFinite(available) ? available : null, requested: qty, capped, finalQty };
  };

  // A bundle is one purchasable package from the customer's perspective.
  // Internally the cart keeps the component products (with their quantities)
  // so the order can deduct component inventory on completion.
  const addBundle = (bundle, qty = 1, price, components) => {
    const lineId = `bundle::${bundle.id}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) => (i.lineId === lineId ? { ...i, qty: i.qty + qty } : i));
      }
      return [
        ...prev,
        {
          lineId,
          id: bundle.id,
          bundle_id: bundle.id,
          is_bundle: true,
          name: bundle.name,
          price,
          image_url: bundle.image_url,
          qty,
          bundle_items: components,
        },
      ];
    });
  };

  const removeItem = (lineId) =>
    setItems((prev) => prev.filter((i) => (i.lineId || i.id) !== lineId));

  const updateQty = (lineId, qty) => {
    const line = items.find((i) => (i.lineId || i.id) === lineId);
    const max = line && typeof line.stock === 'number' && Number.isFinite(line.stock) ? line.stock : Infinity;
    const finalQty = Number.isFinite(max) ? Math.min(Math.max(1, qty), Math.max(1, max)) : Math.max(1, qty);
    const capped = Number.isFinite(max) && qty > max;
    setItems((prev) =>
      prev.map((i) => ((i.lineId || i.id) === lineId ? { ...i, qty: finalQty } : i))
    );
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
    const products = await Promise.all(ids.map((id) => base44.entities.Product.get(id).catch(() => null)));
    const map = {};
    products.forEach((p) => { if (p) map[p.id] = p; });
    const adjustments = [];
    const next = items
      .map((i) => {
        if (i.is_bundle || !i.id) return i;
        const p = map[i.id];
        if (!p) return i;
        let available;
        if (i.variant_key && Array.isArray(p.variants)) {
          const v = p.variants.find((x) => x && x.key === i.variant_key);
          available = v ? Number(v.stock ?? 0) : 0;
        } else {
          available = p.stock != null ? Number(p.stock) : Infinity;
        }
        if (!Number.isFinite(available)) return i; // unlimited
        if (i.qty > available) {
          const newQty = Math.max(0, available);
          adjustments.push({ id: i.id, name: i.name, variant_label: i.variant_label || null, oldQty: i.qty, newQty });
          if (newQty <= 0) return null;
          return { ...i, qty: newQty, stock: available };
        }
        return { ...i, stock: available };
      })
      .filter(Boolean);
    if (adjustments.length > 0) setItems(next);
    return adjustments;
  };

  // Apply a backend "insufficient" list (from commitOrderStock) directly —
  // caps each affected line to its real available quantity, removing lines
  // that are now out of stock. Returns the adjustments for messaging.
  const adjustForInsufficient = (insufficient) => {
    if (!Array.isArray(insufficient) || insufficient.length === 0) return [];
    const adjustments = [];
    const next = items
      .map((i) => {
        const match = insufficient.find((s) => s.id === i.id && (s.variant_key || null) === (i.variant_key || null));
        if (!match) return i;
        const newQty = Math.max(0, Number(match.available || 0));
        adjustments.push({ id: i.id, name: i.name, variant_label: i.variant_label || null, oldQty: i.qty, newQty, available: match.available });
        if (newQty <= 0) return null;
        return { ...i, qty: newQty, stock: newQty };
      })
      .filter(Boolean);
    setItems(next);
    return adjustments;
  };

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, addBundle, addWheelReward, removeItem, updateQty, clear, count, total, revalidateStock, adjustForInsufficient }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);