import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Loader2, Check, Sun, Moon, Monitor, LogOut, User as UserIcon, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

const THEME_OPTS = [
  { key: 'light', icon: Sun },
  { key: 'dark', icon: Moon },
  { key: 'system', icon: Monitor },
];

export default function SettingsDialog({ open, onOpenChange }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState(user?.full_name || '');
  const [savedName, setSavedName] = useState(false);

  const reset = () => {
    setConfirming(false);
    setBusy(false);
    setError(null);
    setSavedName(false);
  };

  const saveName = async () => {
    setBusy(true);
    setError(null);
    try {
      await base44.auth.updateMe({ full_name: name });
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout('/');
    } catch {
      window.location.href = '/';
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await base44.functions.invoke('deleteAccount', {});
      onOpenChange(false);
      logout();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to delete account');
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{t('settings.title')}</DialogTitle>
          <DialogDescription>
            {user ? `${t('settings.signedIn')} ${user.email}` : t('settings.notSignedIn')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4 max-h-[70vh] overflow-auto pr-1">
          {/* Theme */}
          <div className="rounded-2xl bg-mist p-4">
            <p className="font-heading font-bold">{t('settings.theme')}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{t('settings.themeDesc')}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {THEME_OPTS.map((o) => {
                const active = theme === o.key;
                return (
                  <button
                    key={o.key}
                    onClick={() => setTheme(o.key)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                      active ? 'border-cosmic bg-cosmic/10 text-cosmic' : 'border-border hover:border-cosmic/40'
                    }`}
                  >
                    <o.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{t(`settings.${o.key}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language */}
          <div className="rounded-2xl bg-mist p-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cosmic" />
              <p className="font-heading font-bold">{t('settings.language')}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { key: 'en', label: 'English' },
                { key: 'ar', label: 'العربية' },
              ].map((o) => (
                <button
                  key={o.key}
                  onClick={() => setLang(o.key)}
                  className={`py-3 rounded-xl border-2 font-medium transition-all ${
                    lang === o.key ? 'border-cosmic bg-cosmic/10 text-cosmic' : 'border-border hover:border-cosmic/40'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account */}
          {user && (
            <div className="rounded-2xl bg-mist p-4">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-cosmic" />
                <p className="font-heading font-bold">{t('settings.account')}</p>
              </div>
              <label className="block mt-4">
                <span className="text-sm font-medium text-foreground/80">{t('settings.name')}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('settings.name')}
                  className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
                />
              </label>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveName}
                  disabled={busy}
                  className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : savedName ? <Check className="w-4 h-4" /> : null}
                  {savedName ? t('settings.saved') : t('settings.save')}
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-card border border-border font-heading font-bold text-sm disabled:opacity-60"
                >
                  {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  {signingOut ? t('settings.signingOut') : t('settings.signOut')}
                </button>
              </div>
            </div>
          )}

          {!user && (
            <div className="rounded-2xl bg-mist p-4">
              <p className="text-sm text-muted-foreground">{t('settings.notSignedIn')}</p>
              <button
                onClick={() => { onOpenChange(false); navigate('/login'); }}
                className="mt-3 squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm"
              >
                {t('settings.signIn')}
              </button>
            </div>
          )}

          {/* Delete account */}
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-heading font-bold text-destructive">{t('settings.delete')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('settings.deleteDesc')}</p>
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="mt-3 squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-destructive text-white font-heading font-bold text-sm hover:opacity-90"
              >
                <Trash2 className="w-4 h-4" /> {t('settings.delete')}
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-medium">{t('settings.confirm')}</p>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-destructive text-white font-heading font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {busy ? t('settings.deleting') : t('settings.yesDelete')}
                  </button>
                  <button
                    onClick={() => { setConfirming(false); setError(null); }}
                    disabled={busy}
                    className="squish h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm"
                  >
                    {t('settings.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}