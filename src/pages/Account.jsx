import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Camera, Trash2, Loader2, Package, MapPin, Undo2, Heart, Gift, Settings as SettingsIcon, LogOut, Award, RotateCw, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import SettingsDialog from '@/components/SettingsDialog';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { getLoyaltyBalance } from '@/lib/loyaltyFunctions';
import { useAvailableSpins } from '@/lib/useAvailableSpins';

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const initialsOf = (user) => {
  const src = (user?.full_name || user?.email || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

// /account -- customer dashboard: profile photo, contact details, available
// points/spins and shortcuts to the existing account pages.
export default function Account() {
  const { t } = useLanguage();
  const { user, isLoadingAuth, authChecked, logout, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const spins = useAvailableSpins();
  const [points, setPoints] = useState(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    getLoyaltyBalance().then((r) => { if (r?.success) setPoints(Number(r.balance) || 0); }).catch(() => {});
  }, [user]);

  if (isLoadingAuth || !authChecked) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent('/account')}`} replace />;

  const removeStored = async () => {
    const { data } = await supabase.storage.from('avatars').list(user.id);
    if (data?.length) await supabase.storage.from('avatars').remove(data.map((f) => `${user.id}/${f.name}`));
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) { toast({ title: t('acct.badType'), variant: 'destructive' }); return; }
    if (file.size > MAX_BYTES) { toast({ title: t('acct.tooBig'), variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.${EXT[file.type]}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id);
      if (dbErr) throw dbErr;
      // Drop the previous photo(s) so the folder never accumulates files.
      const { data: files } = await supabase.storage.from('avatars').list(user.id);
      const stale = (files || []).filter((f) => `${user.id}/${f.name}` !== path).map((f) => `${user.id}/${f.name}`);
      if (stale.length) await supabase.storage.from('avatars').remove(stale);
      await checkUserAuth();
      toast({ title: t('acct.photoSaved') });
    } catch (err) {
      toast({ title: err.message || t('acct.photoFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
      if (error) throw error;
      await removeStored();
      await checkUserAuth();
      toast({ title: t('acct.photoRemoved') });
    } catch (err) {
      toast({ title: err.message || t('acct.photoFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const links = [
    { to: '/orders', icon: Package, label: t('nav.orders') },
    { to: '/addresses', icon: MapPin, label: t('address.title') },
    { to: '/returns', icon: Undo2, label: t('returns.myRequests') },
    { to: '/wishlist', icon: Heart, label: t('nav.wishlist') },
    { to: '/wallet', icon: Gift, label: t('mnav.rewards') },
  ];
  const row = 'flex w-full items-center gap-3 rounded-2xl bg-card border border-border/60 px-4 py-3.5 font-heading font-bold text-start';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('mnav.account')} />
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative w-28 h-28 rounded-full overflow-hidden bg-cosmic text-white grid place-items-center text-4xl font-heading font-extrabold ring-4 ring-cosmic/20">
            {user.avatar_url ? <img src={user.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initialsOf(user)}
            {busy && <div className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="w-7 h-7 animate-spin" /></div>}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-cosmic text-white text-sm font-heading font-bold disabled:opacity-60">
              <Camera className="w-4 h-4" /> {user.avatar_url ? t('acct.change') : t('acct.upload')}
            </button>
            {user.avatar_url && (
              <button type="button" disabled={busy} onClick={onRemove} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-mist text-destructive text-sm font-heading font-bold disabled:opacity-60">
                <Trash2 className="w-4 h-4" /> {t('acct.remove')}
              </button>
            )}
          </div>
          <h1 className="mt-4 font-heading font-extrabold text-2xl">{user.full_name || user.email}</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">{user.email}</p>
          {user.phone && <p className="text-sm text-muted-foreground" dir="ltr">{user.phone}</p>}
        </div>

        <Link to="/wallet" className="mt-6 flex items-center justify-around rounded-2xl bg-mist border border-border/60 px-4 py-3">
          <span className="inline-flex items-center gap-2 font-heading font-bold"><Award className="w-5 h-5 text-cosmic" /> {points ?? '…'} {t('mhome.points')}</span>
          <span className="inline-flex items-center gap-2 font-heading font-bold"><RotateCw className="w-5 h-5 text-accent" /> {spins ?? 0} {t('mhome.spins')}</span>
        </Link>

        <div className="mt-5 grid gap-2.5">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={row}>
              <l.icon className="w-5 h-5 text-cosmic shrink-0" /> <span className="flex-1">{l.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground rtl:rotate-180" />
            </Link>
          ))}
          <button type="button" onClick={() => setSettingsOpen(true)} className={row}>
            <SettingsIcon className="w-5 h-5 text-cosmic shrink-0" /> <span className="flex-1">{t('mnav.accountSettings')}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => logout('/')} className={`${row} text-destructive`}>
            <LogOut className="w-5 h-5 shrink-0" /> <span className="flex-1">{t('settings.signOut')}</span>
          </button>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Footer />
    </div>
  );
}
