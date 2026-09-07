import { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

// Product data splits into two halves with very different freshness needs
// (see the caching/freshness audit):
//   - descriptive (name, description, images, category, age, gender, tags...)
//     is safe to display from a normal fetch/cache — it does not change the
//     moment someone looks at it.
//   - commercial (price, sale_price, stock/variant stock) is business-
//     critical and must never sit behind a stale cache while a customer is
//     actively looking at the product.
// Rather than duplicating product state or polling, this subscribes to
// Supabase Realtime for just this one row (server-side filtered, so no
// unrelated product's changes are even sent to the client) and patches only
// the commercial fields whenever the row changes — the descriptive object
// fetched once by the page is left completely alone.
const COMMERCIAL_FIELDS = ['price', 'sale_price', 'stock', 'variants'];

function pickCommercial(row) {
  const out = {};
  for (const f of COMMERCIAL_FIELDS) out[f] = row?.[f];
  return out;
}

export function useProductCommercial(productId, initialProduct) {
  const [commercial, setCommercial] = useState(() => (initialProduct ? pickCommercial(initialProduct) : null));

  // The initial fetch (done by the page itself, e.g. db.Product.get) already
  // carries the commercial fields at load time — resync whenever a *new*
  // product loads (id change), without ever clobbering a value the realtime
  // subscription below has since updated for the same id.
  useEffect(() => {
    if (initialProduct) setCommercial(pickCommercial(initialProduct));
  }, [productId, initialProduct]);

  useEffect(() => {
    if (!productId) return;
    const channel = supabase
      .channel(`product-commercial-${productId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${productId}` },
        (payload) => setCommercial(pickCommercial(payload.new))
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [productId]);

  return commercial;
}
