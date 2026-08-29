import React, { useState } from 'react';
import { db } from '@/api/entities';
import { Search, X, Package } from 'lucide-react';

// Generic product selector for admin surfaces (challenges, etc.). Searches the
// live catalog by name, barcode, or variant SKU. Stores the chosen product id
// + name on the parent so the saved record references the exact product.
export default function ProductPicker({ value, productName, onSelect, placeholder }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  const search = async (text) => {
    setQ(text);
    if (!text.trim()) { setResults([]); setOpen(false); return; }
    const all = await db.Product.list('-created_date', 200).catch(() => []);
    const t = text.toLowerCase();
    const matched = (all || []).filter((p) => {
      if ((p.name || '').toLowerCase().includes(t)) return true;
      if ((p.barcode || '').toLowerCase().includes(t)) return true;
      if (Array.isArray(p.variants) && p.variants.some((v) => (v.sku || '').toLowerCase().includes(t))) return true;
      if ((p.id || '').slice(-6).toLowerCase().includes(t)) return true;
      return false;
    }).slice(0, 8);
    setResults(matched);
    setOpen(true);
  };

  const pick = (p) => {
    onSelect({ product_id: p.id, product_name: p.name });
    setQ('');
    setResults([]);
    setOpen(false);
  };

  const clear = () => onSelect({ product_id: '', product_name: '' });

  if (value) {
    return (
      <div className="flex items-center gap-2 h-11 px-3 rounded-2xl bg-mist border border-border">
        <Package className="w-4 h-4 text-cosmic shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">{productName || value}</span>
        <button type="button" onClick={clear} className="grid place-items-center w-8 h-8 rounded-full hover:bg-background"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 h-11 px-3 rounded-2xl bg-mist border border-border">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          className="flex-1 bg-transparent outline-none text-sm"
          placeholder={placeholder || 'Search by name, SKU or barcode…'}
          value={q}
          onChange={(e) => search(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl bg-card border border-border shadow-xl max-h-64 overflow-auto">
          {results.map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p)} className="w-full text-start px-3 py-2 hover:bg-mist flex items-center gap-2 border-b border-border/40 last:border-0">
              <span className="flex-1 text-sm truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.barcode || (Array.isArray(p.variants) && p.variants[0]?.sku) || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}