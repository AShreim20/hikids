import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, Package } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { Checkbox } from '@/components/ui/checkbox';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/context/LanguageContext';
import { lineItemName } from '@/lib/bilingual';

const lineIdOf = (i) => i.lineId || i.id;
// Invisible extension of the tappable area to >=48px while the icon stays compact.
const TAP = "relative after:absolute after:-inset-2 after:content-['']";

// Mobile (<768px) cart. All state/handlers live in Cart.jsx (same selection,
// stock and checkout logic); every total here is computed from SELECTED,
// purchasable lines only, so it updates immediately with selection/quantity.
export default function MobileCartView({ items, selected, allSelected, availIds, toggleOne, toggleAll, inc, dec, removeItem, clearCart, goCheckout }) {
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const [pendingDelete, setPendingDelete] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);

  const chosen = items.filter((i) => !i.unavailable && selected.has(lineIdOf(i)));
  const total = chosen.reduce((s, i) => s + i.qty * i.price, 0);
  const canCheckout = chosen.length > 0;

  const stockText = (i) => {
    if (i.unavailable) return ar ? 'غير متوفر' : 'Out of stock';
    const s = Number(i.stock);
    if (!Number.isFinite(s)) return ar ? 'متوفر' : 'In stock';
    return s <= 5 ? (ar ? `متبقي ${s} فقط` : `Only ${s} left`) : (ar ? 'متوفر' : 'In stock');
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('cart.title')} />
      <div className="px-4 pt-3 pb-40">
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-3 min-h-12 cursor-pointer select-none">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="w-6 h-6" aria-label={ar ? 'تحديد الكل' : 'Select all'} />
            <span className="font-heading font-bold text-sm">{ar ? 'تحديد الكل' : 'Select All'}</span>
          </label>
          <button type="button" onClick={() => setClearOpen(true)} className="min-h-12 px-2 text-xs font-heading font-bold text-muted-foreground underline underline-offset-2">
            {ar ? 'إفراغ السلة' : 'Clear Cart'}
          </button>
        </div>

        <div className="mt-1 space-y-3">
          {items.map((i) => {
            const id = lineIdOf(i);
            const checked = selected.has(id);
            const unavail = !!i.unavailable;
            const name = lineItemName(i, lang);
            return (
              <div key={id} className={`flex items-center gap-3 rounded-2xl border p-3 ${unavail ? 'border-border/60 opacity-60' : checked ? 'border-cosmic bg-cosmic/5' : 'border-border/60 bg-card'}`}>
                <Checkbox checked={checked} disabled={unavail} onCheckedChange={unavail ? undefined : () => toggleOne(id)} className="w-6 h-6 shrink-0" aria-label={ar ? 'تحديد العنصر' : 'Select item'} />
                <Link to={i.is_bundle ? `/bundles/${i.id}` : `/product/${i.id}`} className="shrink-0">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-mist">
                    <Image src={i.image_url} alt={name} fittingType="fill" className="w-full h-full object-contain" />
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      {i.is_bundle && <span className="inline-flex items-center gap-1 text-[11px] font-heading font-bold text-cosmic"><Package className="w-3 h-3" /> {ar ? 'حزمة' : 'Bundle'}</span>}
                      <p className="font-heading font-bold text-sm leading-snug line-clamp-2">{name}</p>
                      {i.variant_label && <p className="text-xs font-heading font-bold text-cosmic">{i.variant_label}</p>}
                    </div>
                    <button type="button" onClick={() => setPendingDelete(id)} className={`${TAP} shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted-foreground`} aria-label={ar ? 'حذف المنتج' : 'Remove item'}>
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <p className={`text-xs mt-0.5 ${unavail ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>{stockText(i)}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="font-heading font-extrabold text-sm">{unavail ? '—' : formatPrice(i.price * i.qty)}</span>
                    {i.is_wheel_reward ? (
                      <span className="px-3 h-9 grid place-items-center rounded-full bg-mist font-heading font-bold text-sm">×1</span>
                    ) : (
                      <div className="flex items-center rounded-full bg-mist">
                        <button type="button" onClick={() => dec(id, i.qty)} disabled={unavail || i.qty <= 1} className={`${TAP} grid place-items-center w-9 h-9 rounded-full disabled:opacity-40`} aria-label={ar ? 'تقليل الكمية' : 'Decrease quantity'}>
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-7 text-center font-heading font-bold text-sm">{i.qty}</span>
                        <button type="button" onClick={() => inc(id, i.qty + 1)} disabled={unavail} className={`${TAP} grid place-items-center w-9 h-9 rounded-full disabled:opacity-40`} aria-label={ar ? 'زيادة الكمية' : 'Increase quantity'}>
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl bg-mist p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{ar ? 'المنتجات المحددة' : 'Selected products'}</span>
            <span className="font-heading font-bold">{chosen.length}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">{t('common.subtotal')}</span>
            <span className="font-heading font-bold">{formatPrice(total)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('common.calculatedAtCheckout')}</p>
        </div>
        <Footer />
      </div>

      <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-xl px-4 pt-3 safe-bottom pb-3">
        <button type="button" onClick={goCheckout} disabled={!canCheckout} className="squish w-full h-14 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-50">
          {ar ? 'متابعة إلى الدفع' : 'Continue to Checkout'} — {formatPrice(total)}
        </button>
      </div>

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? 'حذف المنتج؟' : 'Remove this item?'}</AlertDialogTitle>
            <AlertDialogDescription>{ar ? 'سيتم حذف المنتج من سلتك.' : 'This item will be removed from your cart.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { removeItem(pendingDelete); setPendingDelete(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{ar ? 'حذف' : 'Remove'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? 'إفراغ السلة' : 'Clear cart?'}</AlertDialogTitle>
            <AlertDialogDescription>{ar ? 'هل أنت متأكد أنك تريد إزالة جميع العناصر من سلتك؟' : 'Are you sure you want to remove all items from your cart?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { clearCart(); setClearOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{ar ? 'إفراغ' : 'Clear'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
