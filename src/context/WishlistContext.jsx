import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

const WishlistContext = createContext(null);
const STORAGE_KEY = 'hikids_wishlist_v1';

export function WishlistProvider({ children }) {
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

  // Same reasoning as CartContext: this is device-local storage, not
  // per-user server state, so it must not leak into the next account signed
  // in on the same browser. Only a real SIGNED_OUT clears it.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setItems([]);
    });
    return () => subscription.unsubscribe();
  }, []);

  const toggle = (product) =>
    setItems((prev) =>
      prev.some((i) => i.id === product.id)
        ? prev.filter((i) => i.id !== product.id)
        : [
            ...prev,
            {
              id: product.id,
              name: product.name,
              name_en: product.name_en,
              price: product.price,
              // Needed so priceInfo() can detect a product-level discount on
              // the Wishlist page (see Wishlist.jsx) — without it, a
              // sale_price discount silently never shows there.
              sale_price: product.sale_price,
              image_url: product.image_url,
              category: product.category,
            },
          ]
    );

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const isSaved = (id) => items.some((i) => i.id === id);
  const count = items.length;

  return (
    <WishlistContext.Provider value={{ items, toggle, remove, isSaved, count }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);