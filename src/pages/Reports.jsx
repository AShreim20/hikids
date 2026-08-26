import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Loader2, BarChart3, Receipt, CreditCard, ShoppingCart, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { PeriodSelector } from '@/components/reports/ReportShared';
import ProfitLossPanel from '@/components/reports/ProfitLossPanel';
import SalesPanel from '@/components/reports/SalesPanel';
import PaymentsPanel from '@/components/reports/PaymentsPanel';
import PurchasesPanel from '@/components/reports/PurchasesPanel';
import { periodRange, salesReport, paymentsReport, purchasesReport, profitLoss, buildProductMap } from '@/lib/reports';

const TABS = [
  { id: 'pnl', labelKey: 'reports.pnl', icon: TrendingUp },
  { id: 'sales', labelKey: 'reports.sales', icon: BarChart3 },
  { id: 'payments', labelKey: 'reports.payments', icon: CreditCard },
  { id: 'purchases', labelKey: 'reports.purchases', icon: ShoppingCart },
];

export default function Reports() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const [tab, setTab] = useState('pnl');
  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [pos, setPos] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin') { setLoading(false); return; }
    Promise.all([
      base44.entities.Order.list('-created_date', 500),
      base44.entities.Product.list('-updated_date', 500),
      base44.entities.PurchaseOrder.list('-created_date', 500),
      base44.entities.SupplierTransaction.list('-created_date', 500),
    ])
      .then(([o, p, po, tx]) => { setOrders(o || []); setProducts(p || []); setPos(po || []); setTxs(tx || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const productMap = useMemo(() => buildProductMap(products), [products]);
  const range = useMemo(() => periodRange(period, custom), [period, custom]);

  const data = useMemo(() => {
    if (tab === 'pnl') return profitLoss(orders, productMap, range);
    if (tab === 'sales') return salesReport(orders, productMap, range);
    if (tab === 'payments') return paymentsReport(orders, txs, range);
    return purchasesReport(pos, range);
  }, [tab, orders, productMap, txs, pos, range]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('admin.deniedDesc')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('admin.title')}</Link>
        <div className="mt-6">
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('admin.subtitle')}</p>
          <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{ar ? 'التقارير' : 'Reports'}</h1>
          <p className="mt-2 text-muted-foreground">{ar ? 'تحليل أداء الأعمال من بيانات المبيعات والمدفوعات والمشتريات.' : 'Business performance from your sales, payments, and purchase data.'}</p>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`shrink-0 inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-heading font-bold transition-colors ${tab === tb.id ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70 hover:bg-cosmic/10'}`}
            >
              <tb.icon className="w-4 h-4" /> {t(tb.labelKey)}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <PeriodSelector period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : tab === 'pnl' ? (
          <ProfitLossPanel data={data} />
        ) : tab === 'sales' ? (
          <SalesPanel data={data} />
        ) : tab === 'payments' ? (
          <PaymentsPanel data={data} />
        ) : (
          <PurchasesPanel data={data} />
        )}
      </div>
      <Footer />
    </div>
  );
}