import React, { createContext, useContext, useEffect, useState } from 'react';
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
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) => (i.lineId === lineId ? { ...i, qty: i.qty + qty } : i));
      }
      return [
        ...prev,
        {
          lineId,
          id: product.id,
          name: product.name,
          price: price != null ? price : (product.sale_price ?? product.price),
          image_url: product.image_url,
          qty,
          variant_key: variant?.key || null,
          variant_label: variant ? variantLabel(variant.attributes) : null,
          variant_attributes: variant?.attributes || null,
          sku: variant?.sku || null,
        },
      ];
    });
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

  const updateQty = (lineId, qty) =>
    setItems((prev) =>
      prev.map((i) =>
        (i.lineId || i.id) === lineId ? { ...i, qty: Math.max(1, qty) } : i
      )
    );

  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, addBundle, removeItem, updateQty, clear, count, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);