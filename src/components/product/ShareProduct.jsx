import React, { useState } from 'react';
import { Share2, Link2, Check, Heart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

// Customer-facing secondary action group: Favorite, Share, Copy Link,
// WhatsApp — one visual family, same height/radius/padding/typography, so
// none of the four reads as more (or less) important than the others.
// Favorite's add/remove logic still lives in WishlistContext (via
// ProductDetail's toggle/isSaved) and is only passed in here as props — this
// component owns presentation, not the business logic.
//
// Deliberately flexbox, not CSS grid, for the 2-up mobile layout: a grid's
// auto-placed column order does not reliably mirror under dir="rtl" (verified
// live — item 1 landed top-left, item 2 top-right, in Arabic), while a flex
// row's item order does reverse correctly for RTL. Each button gets an
// explicit ~50% basis so two sit per row on mobile; from `sm:` up they
// revert to auto width and wrap freely if a narrow window can't fit all four.
export default function ShareProduct({ product, favorited, onToggleFavorite }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/product/${product.id}`;
  const text = ar
    ? `شوف هذا المنتج على هاي كيدز: ${product.name}`
    : `Check out this toy from HiKids: ${product.name}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text, url });
        return;
      } catch {
        /* user cancelled — fall through to nothing */
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
        toast({ title: ar ? 'تم نسخ الرابط' : 'Link copied' });
      })
      .catch(() => toast({ title: ar ? 'تعذّر النسخ' : 'Copy failed', variant: 'destructive' }));
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

  const actionClass = 'squish inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full font-heading font-bold text-sm transition-colors';
  // ~50% width minus half the gap, so exactly two fit per row on mobile;
  // free-width and wrappable from sm: up.
  const cell = 'w-[calc(50%-0.25rem)] sm:w-auto';

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={!!favorited}
        className={`${actionClass} ${cell} ${
          favorited ? 'bg-accent text-white hover:opacity-90' : 'bg-mist text-foreground hover:bg-cosmic hover:text-white'
        }`}
      >
        <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} /> {ar ? 'المفضلة' : 'Favorite'}
      </button>
      <button onClick={share} className={`${actionClass} ${cell} bg-mist text-foreground hover:bg-cosmic hover:text-white`}>
        <Share2 className="w-4 h-4" /> {ar ? 'مشاركة' : 'Share'}
      </button>
      <button onClick={copy} className={`${actionClass} ${cell} bg-mist text-foreground hover:bg-cosmic hover:text-white`}>
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        {copied ? (ar ? 'تم النسخ' : 'Copied') : ar ? 'نسخ الرابط' : 'Copy link'}
      </button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className={`${actionClass} ${cell} bg-emerald-600 text-white hover:bg-emerald-700`}
      >
        <WhatsAppIcon className="w-4 h-4" /> WhatsApp
      </a>
    </div>
  );
}
