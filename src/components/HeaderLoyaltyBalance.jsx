import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrap } from '@/lib/invoke';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

// Live loyalty points balance chip for the header. Fetches the real balance
// from the backend; renders nothing for logged-out users or while unloaded,
// so no fake/default number is ever shown.
export default function HeaderLoyaltyBalance() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!user) { setBalance(null); return; }
    let alive = true;
    base44.functions
      .invoke('getLoyaltyBalance', {})
      .then((raw) => {
        const res = unwrap(raw);
        if (alive && res?.success) setBalance(Number(res.balance) || 0);
      })
      .catch(() => { if (alive) setBalance(null); });
    return () => { alive = false; };
  }, [user]);

  if (!user || balance === null) return null;

  return (
    <button
      onClick={() => navigate('/loyalty')}
      className="hidden md:inline-flex squish items-center gap-1.5 h-11 px-3 rounded-2xl bg-white/15 text-white hover:bg-accent hover:text-white transition-colors"
      aria-label={t('loyalty.mynav')}
      title={t('loyalty.mynav')}
    >
      <Sparkles className="w-4 h-4 shrink-0" />
      <span className="font-heading font-bold text-sm tabular-nums leading-none">{balance}</span>
      <span className="text-[11px] font-medium opacity-70 leading-none">{lang === 'ar' ? 'نقطة' : 'pts'}</span>
    </button>
  );
}