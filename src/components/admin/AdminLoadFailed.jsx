import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

// Shown by admin list pages instead of their normal body when the data could
// not be loaded, so a failed request is never mistaken for "nothing here".
// failure: 'session' (expired login: offer retry + explicit re-login, never an
// automatic redirect) or 'error' (network/server: offer retry only).
// `inline` renders just the notice (no page shell) for panels embedded in a page.
export default function AdminLoadFailed({ failure, onRetry, inline = false }) {
  const { t } = useLanguage();
  const { navigateToLogin, checkUserAuth } = useAuth();
  const expired = failure === 'session';

  const body = (
      <div className={inline ? 'max-w-2xl mx-auto px-5 py-10 text-center' : 'max-w-2xl mx-auto px-5 py-32 text-center'}>
        <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
          {expired ? <Lock className="w-8 h-8 text-destructive" /> : <AlertTriangle className="w-8 h-8 text-destructive" />}
        </div>
        <h1 className="mt-6 font-heading font-extrabold text-3xl">
          {expired ? t('users.sessionExpiredTitle') : t('adminLoad.errorTitle')}
        </h1>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          {expired ? t('users.sessionExpiredDesc') : t('adminLoad.errorDesc')}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => { if (expired) checkUserAuth(); onRetry(); }}
            className="squish h-11 px-6 rounded-full bg-mist font-heading font-bold text-sm"
          >
            {t('users.retry')}
          </button>
          {expired && (
            <button
              type="button"
              onClick={navigateToLogin}
              className="squish h-11 px-6 rounded-full bg-cosmic text-white font-heading font-bold text-sm"
            >
              {t('users.loginAgain')}
            </button>
          )}
        </div>
      </div>
  );

  if (inline) return body;
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {body}
      <Footer />
    </div>
  );
}
