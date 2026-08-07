import React, { createContext, useContext, useEffect, useState } from 'react';

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

  const toggle = (product) =>
    setItems((prev) =>
      prev.some((i) => i.id === product.id)
        ? prev.filter((i) => i.id !== product.id)
        : [
            ...prev,
            {
              id: product.id,
              name: product.name,
              price: product.price,
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