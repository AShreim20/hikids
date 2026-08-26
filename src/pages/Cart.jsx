import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, ArrowLeft, Package } from 'lucide-react';
import { Image } from '@/components/ui/image';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useToast } from '@/components/ui/use-toast';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { lineItemName } from '@/lib/bilingual';
import ShareCartButton from '@/components/cart/ShareCartButton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const lineIdOf = (i) => i.lineId || i.id;

export default function Cart() {
  const { items, updateQty, removeItem, removeItems, clear, total, count, revalidateStock, setCheckoutSelection } = useCart();
  const navigate = useNavigate();
  const { t, formatPrice, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();

  // Per-line selection (a Set of lineIds) for the bulk delete actions.
  const [selected, setSelected] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const allIds = items.map(lineIdOf);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  // Keep the selection set in sync with the cart — drop ids whose lines no
  // longer exist (e.g. after stock revalidation removes a sold-out item) so
  // the "N selected" count and "Select All" state never go stale.
  useEffect(() => {
    setSelected((prev) => {
      const live = new Set(allIds);
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (live.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    const n = selected.size;
    removeItems(Array.from(selected));
    setSelected(new Set());
    toast({ title: ar ? `تم حذف ${n} عنصر` : `Removed ${n} ${n === 1 ? 'item' : 'items'}` });
  };

  const deleteAll = () => {
    clear();
    setSelected(new Set());
    setConfirmOpen(false);
    toast({ title: ar ? 'تم إفراغ السلة' : 'Cart cleared' });
  };

  // Only the currently-selected lines go to checkout. Unselected items stay
  // in the cart untouched.
  const goCheckout = () => {
    if (selected.size === 0) {
      toast({ title: ar ? 'اختر منتجًا واحدًا على الأقل' : 'Please select at least one item', variant: 'destructive' });
      return;
    }
    setCheckoutSelection(new Set(selected));
    navigate('/checkout');
  };

  // Re-check inventory when the cart opens and adjust any lines that sold out
  // or dropped below the requested quantity while the customer was away.
  useEffect(() => {
    let active = true;
    revalidateStock().then((adj) => {
      if (!active || !adj.length) return;
      const removed = adj.filter((a) => a.newQty === 0);
      const reduced = adj.filter((a) => a.newQty > 0);
      const parts = [];
      reduced.forEach((a) => parts.push(ar ? `تم تقليل "${a.name}" إلى ${a.newQty}` : `"${a.name}" reduced to ${a.newQty}`));
      removed.forEach((a) => parts.push(ar ? `"${a.name}" لم يعد متوفرًا` : `"${a.name}" is no longer available`));
      toast({ title: ar ? 'تم تحديث سلتك' : 'Your cart was updated', description: parts.join(' · '), variant: 'destructive' });
    });
    return () => { active = false; };
  }, []);

  const inc = (lineId, qty) => {
    const res = updateQty(lineId, qty);
    if (res.capped) {
      toast({
        title: res.available != null
          ? (ar ? `متوفر ${res.available} فقط` : `Only ${res.available} available`)
          : (ar ? 'وصلت للحد الأقصى' : 'Maximum reached'),
        variant: 'destructive',
      });
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('cart.title')} />
        <div className="max-w-3xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl">{t('cart.empty')}</h1>
          <p className="mt-4 text-muted-foreground text-lg">{t('cart.emptyDesc')}</p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 h-14 px-8 rounded-full bg-cosmic text-white font-heading font-bold squish"
          >
            {t('hero.exploreCta')} <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('cart.title')} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('common.continue')}
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">{t('cart.title')}</h1>
        <p className="mt-2 text-muted-foreground">{count} {t('cart.items')}</p>

        <div className="mt-10 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-4">
            {/* Select-all + bulk actions bar */}
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-3xl bg-mist border border-border/60">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label={ar ? 'تحديد الكل' : 'Select all'} />
                <span className="font-heading font-bold text-sm">
                  {ar ? 'تحديد الكل' : 'Select All'}
                </span>
              </label>
              {selected.size > 0 && (
                <span className="text-xs text-muted-foreground">
                  {ar ? `${selected.size} محدد` : `${selected.size} selected`}
                </span>
              )}
              <div className="ms-auto flex items-center gap-2">
                <button
                  onClick={deleteSelected}
                  disabled={selected.size === 0}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-heading font-bold border border-border bg-card hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-current transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> {ar ? 'حذف المحدد' : 'Delete Selected'}
                </button>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <button
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-heading font-bold border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> {ar ? 'حذف الكل' : 'Delete All'}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{ar ? 'إفراغ السلة' : 'Delete all items?'}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {ar
                          ? 'هل أنت متأكد أنك تريد إزالة جميع العناصر من سلتك؟'
                          : 'Are you sure you want to remove all items from your cart?'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{ar ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {ar ? 'حذف الكل' : 'Delete All'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {items.map((i) => {
              const id = lineIdOf(i);
              const checked = selected.has(id);
              return (
              <div
                key={id}
                className={`flex gap-4 p-4 rounded-3xl bg-card border transition-colors ${
                  checked ? 'border-cosmic bg-cosmic/5 ring-1 ring-cosmic/30' : 'border-border/60'
                }`}
              >
                <div className="flex flex-col items-center gap-2 justify-center">
                  <Checkbox checked={checked} onCheckedChange={() => toggleOne(id)} aria-label={ar ? 'تحديد العنصر' : 'Select item'} />
                </div>
                <Link to={i.is_bundle ? `/bundles/${i.id}` : `/product/${i.id}`} className="shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-mist">
                    <Image src={i.image_url} alt={lineItemName(i, lang)} fittingType="fill" className="w-full h-full object-cover" />
                  </div>
                </Link>
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between gap-4">
                    <div>
                      {i.is_bundle && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cosmic/10 text-cosmic text-[11px] font-heading font-bold mb-1">
                          <Package className="w-3 h-3" /> {ar ? 'حزمة' : 'Bundle'}
                        </span>
                      )}
                      <Link to={i.is_bundle ? `/bundles/${i.id}` : `/product/${i.id}`} className="font-heading font-bold text-lg hover:text-cosmic">
                        {lineItemName(i, lang)}
                      </Link>
                      {i.variant_label && (
                        <p className="text-sm font-heading font-bold text-cosmic mt-1">{i.variant_label}</p>
                      )}
                      {i.is_bundle && Array.isArray(i.bundle_items) && i.bundle_items.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {i.bundle_items.map((c) => `${c.quantity}× ${c.name}`).join(' · ')}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">{formatPrice(i.price)}</p>
                    </div>
                    <button
                      onClick={() => removeItem(id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t('admin.delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center rounded-full bg-mist">
                      <button onClick={() => updateQty(id, i.qty - 1)} className="grid place-items-center w-10 h-10 rounded-full hover:bg-card" aria-label="-">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-heading font-bold text-sm">{i.qty}</span>
                      <button onClick={() => inc(id, i.qty + 1)} className="grid place-items-center w-10 h-10 rounded-full hover:bg-card" aria-label="+">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-heading font-extrabold">{formatPrice(i.price * i.qty)}</p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          <div className="lg:sticky lg:top-28 h-fit rounded-3xl bg-mist p-6 md:p-8">
            <h2 className="font-heading font-extrabold text-2xl">{t('cart.summary')}</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('common.subtotal')}</span>
                <span className="font-heading font-bold">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('common.delivery')}</span>
                <span className="font-heading font-bold text-cosmic">{t('common.calculatedAtCheckout')}</span>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-border/60 flex justify-between items-center">
              <span className="font-heading font-bold">{t('common.total')}</span>
              <span className="font-heading font-extrabold text-2xl">{formatPrice(total)}</span>
            </div>
            <div className="mt-4">
              <ShareCartButton />
            </div>
            <button
              onClick={goCheckout}
              className="squish mt-6 w-full h-14 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors"
            >
              {t('common.checkout')} <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}