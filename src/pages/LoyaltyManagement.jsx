import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LoyaltySettingsForm from '@/components/loyalty/LoyaltySettingsForm';
import WalletDashboard from '@/components/loyalty/WalletDashboard';
import WalletAdminRow from '@/components/loyalty/WalletAdminRow';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';

export default function LoyaltyManagement() {
  const { t } = useLanguage();
  const { can } = usePermissions();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [redeemRate, setRedeemRate] = useState(0.1);

  const canView = can('loyalty.view');
  const perms = {
    canAdd: can('loyalty.add'),
    canRemove: can('loyalty.remove'),
    canViewTx: can('loyalty.transactions.view'),
    canSettings: can('loyalty.settings'),
    redeemRate,
  };

  const load = async () => {
    setLoading(true);
    try {
      setAccounts(await base44.entities.LoyaltyAccount.list('-balance', 200));
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    load();
    base44.entities.Setting.filter({ key: 'loyalty_redeem_rate' })
      .then((rows) => { if (rows && rows.length) setRedeemRate(rows[0].value || 0.1); })
      .catch(() => {});
  }, [canView]);

  if (!canView) {
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

  // Search by customer name, email, phone, customer id or wallet id.
  const q = query.trim().toLowerCase();
  const filtered = accounts.filter((a) =>
    !q ||
    [a.user_email, a.user_name, a.user_phone, a.user_id, a.wallet_code]
      .some((f) => String(f || '').toLowerCase().includes(q))
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('pd.back')}</Link>
        <div className="mt-6">
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('wallet.adminSubtitle')}</p>
          <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('wallet.adminTitle')}</h1>
        </div>

        <div className="mt-8">
          <WalletDashboard />
        </div>

        <div className="mt-8">
          <LoyaltySettingsForm canEdit={perms.canSettings} />
        </div>

        <div className="mt-8 relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('wallet.searchPlaceholder')}
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
              <WalletAdminRow key={a.id} account={a} perms={perms} onChanged={load} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}