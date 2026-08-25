import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const CategoryContext = createContext({
  categories: [],
  discountPctFor: () => 0,
  refresh: async () => {},
});

export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const load = useCallback(() => {
    return base44.entities.Category.list('sort_order', 500)
      .then((list) => setCategories(list || []))
      .catch(() => setCategories([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const discountPctFor = useCallback(
    (name) => {
      if (!name) return 0;
      const c = categories.find((x) => x.name === name);
      return c && c.discount_active && Number(c.discount_percent) > 0 ? Number(c.discount_percent) : 0;
    },
    [categories]
  );

  return (
    <CategoryContext.Provider value={{ categories, discountPctFor, refresh: load }}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoryContext);
}