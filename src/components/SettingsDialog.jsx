import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Trash2, Loader2, Check, Sun, Moon, Monitor, LogOut, User as UserIcon, Globe,
  Mail, Lock, Eye, EyeOff,
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import CountryCodeSelect, { COUNTRY_CODES, dialFor } from '@/components/checkout/CountryCodeSelect';

// Splits a stored "+970 59XXXXXXX"-shaped phone (Checkout's own format) back
// into a country code + local number for editing. Falls back to Palestine
// (Checkout's own default) for a number with no recognized dial code, or an
// empty local part for no phone at all.
function splitPhone(phone) {
  const raw = (phone || '').trim();
  for (const c of COUNTRY_CODES) {
    if (raw.startsWith(c.dial)) return { country: c.code, local: raw.slice(c.dial.length).trim() };
  }
  return { country: 'ps', local: raw };
}

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
  const [phoneCountry, setPhoneCountry] = useState('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [savedName, setSavedName] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSentTo, setEmailSentTo] = useState(null);

  const [hasPassword, setHasPassword] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSaved, setPwSaved] = useState(false);

  // Re-sync the editable fields with the real profile every time the dialog
  // opens (it stays mounted, so a stale value from a previous session would
  // otherwise linger and get resubmitted).
  useEffect(() => {
    if (!open) return;
    setName(user?.full_name || '');
    const { country, local } = splitPhone(user?.phone);
    setPhoneCountry(country);
    setPhoneLocal(local);
    setNewEmail('');
    setEmailSentTo(null);
    setNewPassword('');
    setConfirmPassword('');
    setPwSaved(false);
    // Google-only accounts have no password yet — offer "Set password"
    // instead of "Change password" (Supabase supports adding one to an
    // OAuth identity; this never assumes a password already exists).
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.app_metadata || {};
      const providers = meta.providers || (meta.provider ? [meta.provider] : []);
      setHasPassword(!(providers.includes('google') && !providers.includes('email')));
    }).catch(() => {});
  }, [open, user]);

  const reset = () => {
    setConfirming(false);
    setBusy(false);
    setError(null);
    setSavedName(false);
    setEmailBusy(false);
    setEmailError(null);
    setPwBusy(false);
    setPwError(null);
  };

  // Only ever writes profiles WHERE id = the caller's own auth.uid() — RLS
  // (profiles_owner_update or equivalent) enforces this server-side too, so
  // a forged id here could never edit anyone else's row.
  const saveName = async () => {
    setBusy(true);
    setError(null);
    try {
      const phone = phoneLocal.trim() ? `${dialFor(phoneCountry)} ${phoneLocal.trim()}` : null;
      const { error: updateError } = await supabase.from('profiles').update({ full_name: name, phone }).eq('id', user.id);
      if (updateError) throw updateError;
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  // supabase.auth.updateUser() always targets the current session's own
  // user — there is no id parameter to forge. Email change goes through
  // Supabase's own confirmation flow (a link sent to the new address); the
  // auth email — and, via the sync_profile_email DB trigger, profiles.email
  // — only actually change once that link is clicked.
  const saveEmail = async () => {
    const email = newEmail.trim();
    if (!email) return;
    setEmailBusy(true);
    setEmailError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email });
      if (updateError) throw updateError;
      setEmailSentTo(email);
      setNewEmail('');
    } catch (e) {
      setEmailError(e.message || 'Failed to update email');
    } finally {
      setEmailBusy(false);
    }
  };

  const savePassword = async () => {
    setPwError(null);
    if (newPassword !== confirmPassword) {
      setPwError(t('settings.passwordMismatch'));
      return;
    }
    setPwBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword('');
      setConfirmPassword('');
      setHasPassword(true);
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2000);
    } catch (e) {
      setPwError(e.message || 'Failed to update password');
    } finally {
      setPwBusy(false);
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
      await invokeFunction('deleteAccount', {});
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
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
                <CountryCodeSelect value={phoneCountry} onChange={setPhoneCountry} />
                <label className="block">
                  <span className="text-sm font-medium text-foreground/80">{t('checkout.phone')}</span>
                  <input
                    value={phoneLocal}
                    onChange={(e) => setPhoneLocal(e.target.value)}
                    placeholder="59XXXXXXX"
                    dir="ltr"
                    className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
                  />
                </label>
              </div>
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

          {/* Email */}
          {user && (
            <div className="rounded-2xl bg-mist p-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-cosmic" />
                <p className="font-heading font-bold">{t('settings.email')}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5" dir="ltr">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('settings.emailDesc')}</p>
              <label className="block mt-3">
                <span className="text-sm font-medium text-foreground/80">{t('settings.newEmail')}</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  dir="ltr"
                  autoComplete="email"
                  className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
                />
              </label>
              {emailSentTo && (
                <p className="mt-2 text-sm text-accent">{t('settings.emailConfirmSent').replace('{email}', emailSentTo)}</p>
              )}
              {emailError && <p className="mt-2 text-sm text-destructive">{emailError}</p>}
              <button
                onClick={saveEmail}
                disabled={emailBusy || !newEmail.trim()}
                className="mt-4 squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm disabled:opacity-60"
              >
                {emailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('settings.changeEmail')}
              </button>
            </div>
          )}

          {/* Password & Security */}
          {user && (
            <div className="rounded-2xl bg-mist p-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cosmic" />
                <p className="font-heading font-bold">{t('settings.password')}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {hasPassword ? t('settings.passwordDescChange') : t('settings.passwordDescSet')}
              </p>
              <label className="block mt-3">
                <span className="text-sm font-medium text-foreground/80">{t('settings.newPassword')}</span>
                <div className="relative mt-1.5">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                    className="w-full h-12 px-4 pe-11 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? t('settings.hidePassword') : t('settings.showPassword')}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>
              <label className="block mt-3">
                <span className="text-sm font-medium text-foreground/80">{t('settings.confirmPassword')}</span>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  dir="ltr"
                  className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
                />
              </label>
              {pwError && <p className="mt-2 text-sm text-destructive">{pwError}</p>}
              <button
                onClick={savePassword}
                disabled={pwBusy || !newPassword || !confirmPassword}
                className="mt-4 squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm disabled:opacity-60"
              >
                {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : pwSaved ? <Check className="w-4 h-4" /> : null}
                {pwSaved ? t('settings.passwordSaved') : hasPassword ? t('settings.changePassword') : t('settings.setPassword')}
              </button>
            </div>
          )}

          {!user && (
            <button
              onClick={() => { onOpenChange(false); navigate('/login'); }}
              className="squish w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-cosmic text-white font-heading font-bold text-sm"
            >
              {t('settings.signIn')}
            </button>
          )}

          {/* Delete account */}
          {user && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}