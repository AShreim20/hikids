import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Package, MapPin, Undo2, Wallet, Sparkles, Trophy, Gift,
  Settings as SettingsIcon, Phone, LogOut, LayoutDashboard, Grid2x2, Layers,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import LanguageToggle from '@/components/LanguageToggle';
import { ChooseForKidsMenuMobile } from '@/components/ChooseForKidsMenu';

// Mobile (<768px) hamburger drawer. Only links to existing routes/components;
// opens from the reading-start side (right in Arabic, left in English).
function Item({ to, icon: Icon, label, onClick }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-heading font-bold text-white hover:bg-white/10">
      <Icon className="w-5 h-5 shrink-0 text-white/80" /> {label}
    </Link>
  );
}

function Group({ title, children }) {
  return (
    <section className="mt-4">
      <p className="px-3 pb-1 text-xs font-heading font-bold uppercase tracking-wider text-accent">{title}</p>
      {children}
    </section>
  );
}

export default function MobileMenuDrawer({ open, onOpenChange, onOpenSettings }) {
  const { t, lang } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const ar = lang === 'ar';
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={ar ? 'right' : 'left'} className="w-[85vw] max-w-sm overflow-y-auto border-white/15 bg-[#3A2660] p-4 text-white">
        <SheetTitle className="px-3 pt-2 text-white font-heading font-extrabold text-xl">{t('mnav.menu')}</SheetTitle>

        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={() => { close(); window.dispatchEvent(new Event('hikids:open-admin-menu')); }}
            className="mt-3 flex w-full items-center gap-3 rounded-xl bg-accent px-3 py-3 text-base font-heading font-bold text-white"
          >
            <LayoutDashboard className="w-5 h-5" /> {t('mnav.adminPanel')}
          </button>
        )}

        <Group title={t('mnav.shopping')}>
          <Item to="/shop" icon={Grid2x2} label={t('nav.allToys')} onClick={close} />
          <div className="[&_*]:text-base"><ChooseForKidsMenuMobile onNavigate={close} /></div>
          <Item to="/bundles" icon={Layers} label={t('nav.bundles')} onClick={close} />
        </Group>

        {user && (
          <Group title={t('mnav.orders')}>
            <Item to="/orders" icon={Package} label={t('nav.orders')} onClick={close} />
            <Item to="/addresses" icon={MapPin} label={t('address.title')} onClick={close} />
            <Item to="/returns" icon={Undo2} label={t('returns.myRequests')} onClick={close} />
          </Group>
        )}

        {user && (
          <Group title={t('mnav.rewards')}>
            <Item to="/wallet" icon={Wallet} label={t('mnav.wallet')} onClick={close} />
            <Item to="/wheel" icon={Sparkles} label={t('nav.wheel')} onClick={close} />
            <Item to="/challenges" icon={Trophy} label={t('nav.challenges')} onClick={close} />
            <Item to="/wheel-rewards" icon={Gift} label={t('nav.wheelRewards')} onClick={close} />
          </Group>
        )}

        <Group title={t('mnav.settings')}>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-base font-heading font-bold">{t('mnav.language')}</span>
            <LanguageToggle />
          </div>
          <button type="button" onClick={() => { close(); onOpenSettings(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base font-heading font-bold text-white hover:bg-white/10">
            <SettingsIcon className="w-5 h-5 shrink-0 text-white/80" /> {t('mnav.accountSettings')}
          </button>
          <Item to="/contact" icon={Phone} label={t('contact.title')} onClick={close} />
          {user ? (
            <button
              type="button"
              onClick={async () => { close(); await logout('/'); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base font-heading font-bold text-white hover:bg-white/10"
            >
              <LogOut className="w-5 h-5 shrink-0 text-white/80" /> {t('settings.signOut')}
            </button>
          ) : (
            <button type="button" onClick={() => { close(); navigate('/login'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base font-heading font-bold text-white hover:bg-white/10">
              <ShoppingBag className="w-5 h-5 shrink-0 text-white/80" /> {t('settings.signIn')}
            </button>
          )}
        </Group>
      </SheetContent>
    </Sheet>
  );
}
