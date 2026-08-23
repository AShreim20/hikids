import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Plus, Minus, Search, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';

export default function LoyaltyManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { isOwner } = usePermissions();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [adjusting, setAdjusting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setAccounts(await base44.entities.LoyaltyAccount.list('-lifetime_earned', 200));
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) load();
    else setLoading(false);
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('loyalty.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('loyalty.deniedDesc')}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('pd.back')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const filtered = accounts.filter((a) =>
    !query || (a.user_email || '').toLowerCase().includes(query.toLowerCase()) || (a.user_name || '').toLowerCase().includes(query.toLowerCase())
  );

  const doAdjust = async (acct, delta) => {
    const input = window.prompt(t('loyalty.adjustPrompt'), '');
    if (input === null) return;
    const points = Math.floor(Number(input) || 0);
    if (!points) return;
    const newBalance = Math.max(0, (acct.balance || 0) + (delta > 0 ? points : -points));
    const actualDelta = newBalance - (acct.balance || 0);
    if (actualDelta === 0) return;
    try {
      await base44.entities.LoyaltyAccount.update(acct.id, { balance: newBalance });
      if (actualDelta > 0) {
        await base44.entities.LoyaltyAccount.update(acct.id, { lifetime_earned: (acct.lifetime_earned || 0) + actualDelta });
      }
      await base44.functions.invoke('logAuditActivity', {
        action: 'loyalty.adjusted',
        target_type: 'loyalty_account',
        target_id: acct.id,
        details: `${acct.user_email}: ${actualDelta > 0 ? '+' : ''}${actualDelta} pts`,
      });
      toast({ title: t('address.saved') });
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('pd.back')}</Link>
        <div className="mt-6">
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('loyalty.adminSubtitle')}</p>
          <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('loyalty.adminTitle')}</h1>
        </div>

        <div className="mt-8 relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('loyalty.search')}
            className="w-full h-12 ps-10 pe-4 rounded-full bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
          />
        </div>

        {loading ? (
          <div className="mt-10 grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground py-16">{t('loyalty.empty')}</p>
        ) : (
          <div className="mt-8 space-y-3">
            {filtered.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 rounded-2xl bg-card border border-border/60 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid place-items-center w-11 h-11 rounded-xl bg-accent/15 text-accent shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-bold truncate">{a.user_name || a.user_email}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.user_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-end">
                    <p className="font-heading font-extrabold text-lg">{a.balance || 0}</p>
                    <p className="text-xs text-muted-foreground">{t('loyalty.points')}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => doAdjust(a, 1)} className="grid place-items-center w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" aria-label="Add"><Plus className="w-4 h-4" /></button>
                    <button onClick={() => doAdjust(a, -1)} className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20" aria-label="Remove"><Minus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}