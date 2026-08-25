import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, ArrowLeft, Package } from 'lucide-react';
import { Image } from '@/components/ui/image';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';

export default function Cart() {
  const { items, updateQty, removeItem, total, count } = useCart();
  const navigate = useNavigate();
  const { t, formatPrice, lang } = useLanguage();
  const ar = lang === 'ar';

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
            {items.map((i) => (
              <div key={i.lineId || i.id} className="flex gap-4 p-4 rounded-3xl bg-card border border-border/60">
                <Link to={i.is_bundle ? `/bundles/${i.id}` : `/product/${i.id}`} className="shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-mist">
                    <Image src={i.image_url} alt={i.name} fittingType="fill" className="w-full h-full object-cover" />
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
                        {i.name}
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
                      onClick={() => removeItem(i.lineId || i.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t('admin.delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center rounded-full bg-mist">
                      <button onClick={() => updateQty(i.lineId || i.id, i.qty - 1)} className="grid place-items-center w-10 h-10 rounded-full hover:bg-card" aria-label="-">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-heading font-bold text-sm">{i.qty}</span>
                      <button onClick={() => updateQty(i.lineId || i.id, i.qty + 1)} className="grid place-items-center w-10 h-10 rounded-full hover:bg-card" aria-label="+">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-heading font-extrabold">{formatPrice(i.price * i.qty)}</p>
                  </div>
                </div>
              </div>
            ))}
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
            <button
              onClick={() => navigate('/checkout')}
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