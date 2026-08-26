import React, { useState } from 'react';
import { Share2, Link2, Check, ShoppingCart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';

// Encodes the current cart (product/bundle ids, variant keys, quantities) into
// a compact, URL-safe token. No customer names, emails, or other private data
// are included — only the product references needed to rebuild the cart.
function encodeCart(items) {
  const compact = items.map((i) => ({
    id: i.id,
    q: i.qty,
    v: i.variant_key || undefined,
    b: i.is_bundle ? 1 : undefined,
  }));
  return btoa(encodeURIComponent(JSON.stringify(compact)));
}

export default function ShareCartButton() {
  const { items } = useCart();
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!items.length) return null;

  const url = `${window.location.origin}/cart/shared?c=${encodeCart(items)}`;
  const text = ar
    ? 'شوف هذه السلة من هاي كيدز'
    : 'Check out this HiKids cart';

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'HiKids', text, url });
        return;
      } catch {
        /* cancelled */
      }
      return;
    }
    copy();
  };

  const copy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast({ title: ar ? 'تم نسخ رابط السلة' : 'Cart link copied' });
      })
      .catch(() => toast({ title: ar ? 'تعذّر النسخ' : 'Copy failed', variant: 'destructive' }));
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={share}
        className="squish inline-flex items-center gap-2 h-11 px-4 rounded-full bg-card border border-border text-foreground font-heading font-bold text-sm hover:bg-mist transition-colors"
      >
        <Share2 className="w-4 h-4" /> {ar ? 'مشاركة السلة' : 'Share cart'}
      </button>
      <button
        onClick={copy}
        className="squish inline-flex items-center gap-2 h-11 px-4 rounded-full bg-card border border-border text-foreground font-heading font-bold text-sm hover:bg-mist transition-colors"
      >
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        {copied ? (ar ? 'تم النسخ' : 'Copied') : ar ? 'نسخ الرابط' : 'Copy link'}
      </button>
    </div>
  );
}