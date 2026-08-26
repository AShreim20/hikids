import React, { useState } from 'react';
import { Share2, Link2, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

// Customer-facing product sharing. Uses the device's native share sheet when
// available, with copy-link and WhatsApp fallbacks. The shared URL opens the
// real product page. No reward is granted for merely clicking Share — reward
// eligibility (if any) is governed by the Challenges system's own verification.
export default function ShareProduct({ product }) {
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

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={share}
        className="squish inline-flex items-center gap-2 h-11 px-4 rounded-full bg-mist text-foreground font-heading font-bold text-sm hover:bg-cosmic hover:text-white transition-colors"
      >
        <Share2 className="w-4 h-4" /> {ar ? 'مشاركة' : 'Share'}
      </button>
      <button
        onClick={copy}
        className="squish inline-flex items-center gap-2 h-11 px-4 rounded-full bg-mist text-foreground font-heading font-bold text-sm hover:bg-cosmic hover:text-white transition-colors"
      >
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        {copied ? (ar ? 'تم النسخ' : 'Copied') : ar ? 'نسخ الرابط' : 'Copy link'}
      </button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="squish inline-flex items-center gap-2 h-11 px-4 rounded-full bg-emerald-600 text-white font-heading font-bold text-sm hover:bg-emerald-700 transition-colors"
      >
        <WhatsAppIcon className="w-4 h-4" /> WhatsApp
      </a>
    </div>
  );
}