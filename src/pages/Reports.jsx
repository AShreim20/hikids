import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Loader2, BarChart3, Receipt, CreditCard, ShoppingCart, TrendingUp } from 'lucide-react';
import { db } from '@/api/entities';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { PeriodSelector } from '@/components/reports/ReportShared';
import ProfitLossPanel from '@/components/reports/ProfitLossPanel';
import SalesPanel from '@/components/reports/SalesPanel';
import PaymentsPanel from '@/components/reports/PaymentsPanel';
import PurchasesPanel from '@/components/reports/PurchasesPanel';
import ExpensesPanel from '@/components/reports/ExpensesPanel';
import { periodRange, salesReport, paymentsReport, purchasesReport, profitLoss, expensesReport, buildProductMap } from '@/lib/reports';
import { rangeStamp } from '@/lib/excelExportHelpers';
import ExportExcelButton from '@/components/admin/ExportExcelButton';

const TABS = [
  { id: 'pnl', labelKey: 'reports.pnl', icon: TrendingUp },
  { id: 'sales', labelKey: 'reports.sales', icon: BarChart3 },
  { id: 'payments', labelKey: 'reports.payments', icon: CreditCard },
  { id: 'purchases', labelKey: 'reports.purchases', icon: ShoppingCart },
  { id: 'expenses', labelKey: 'reports.expensesTab', icon: Receipt },
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
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin') { setLoading(false); return; }
    // allSettled: one failing list (e.g. an RLS/permission hiccup on a
    // single entity) shouldn't blank out the rest of the report.
    Promise.allSettled([
      db.Order.list('-created_date', 500),
      db.Product.list('-updated_date', 500),
      db.PurchaseOrder.list('-created_date', 500),
      db.SupplierTransaction.list('-created_date', 500),
      db.Expense.list('-expense_date', 500),
      db.ExpenseCategory.list('sort_order', 200),
    ])
      .then(([o, p, po, tx, exp, cat]) => {
        setOrders(o.status === 'fulfilled' ? o.value || [] : []);
        setProducts(p.status === 'fulfilled' ? p.value || [] : []);
        setPos(po.status === 'fulfilled' ? po.value || [] : []);
        setTxs(tx.status === 'fulfilled' ? tx.value || [] : []);
        setExpenses(exp.status === 'fulfilled' ? exp.value || [] : []);
        setExpenseCategories(cat.status === 'fulfilled' ? cat.value || [] : []);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const productMap = useMemo(() => buildProductMap(products), [products]);
  const range = useMemo(() => periodRange(period, custom), [period, custom]);

  const data = useMemo(() => {
    if (tab === 'pnl') return profitLoss(orders, productMap, range, expenses, expenseCategories);
    if (tab === 'sales') return salesReport(orders, productMap, range);
    if (tab === 'payments') return paymentsReport(orders, txs, range);
    if (tab === 'expenses') return expensesReport(expenses, expenseCategories, range);
    return purchasesReport(pos, range);
  }, [tab, orders, productMap, txs, pos, expenses, expenseCategories, range]);

  // ── Excel export ──────────────────────────────────────────────────────
  // Exports exactly `data` — the same object each report panel already
  // renders from — split into one small sheet per section, so the numbers
  // in the file can never drift from what's on screen (task §7/§8's "use
  // the exact same values/formulas" requirement, satisfied by construction
  // rather than by re-deriving anything).
  const kv = (label, value, opts = {}) => ({ label, value, ...opts });
  const kvColumns = [
    { header: ar ? 'البند' : 'Item', key: 'label', width: 28 },
    { header: ar ? 'القيمة' : 'Value', key: 'value', width: 16, type: 'currency' },
  ];
  const kvSheet = (name, rows) => ({
    name,
    columns: kvColumns,
    rows,
    autoFilter: false,
    boldRowIf: (r) => !!r.bold,
  });
  const dateColumns = [
    { header: ar ? 'التاريخ' : 'Date', key: 'date', width: 14 },
    { header: ar ? 'الإجمالي' : 'Total', key: 'total', width: 16, type: 'currency' },
  ];

  const getReportSheets = () => {
    const stamp = rangeStamp(range.start, range.end);
    if (tab === 'pnl') {
      const rows = [
        kv(t('reports.grossSales'), data.grossSales),
        kv(t('reports.discounts'), data.discounts),
        kv(t('reports.revenue'), data.revenue, { bold: true }),
        kv(t('reports.cogs'), data.cogs),
        kv(t('reports.grossProfit'), data.grossProfit, { bold: true }),
        ...(data.expensesByCategory || []).map((c) =>
          kv(`— ${c.name ? (ar ? c.name : (c.name_en || c.name)) : t('expenses.uncategorized')}`, c.total)
        ),
        kv(t('reports.expenses'), data.expenses, { bold: true }),
        kv(t('reports.netProfit'), data.netProfit, { bold: true }),
      ];
      return { sheets: [kvSheet(ar ? 'الأرباح والخسائر' : 'Profit & Loss', rows)], fileName: `profit-loss_${stamp}.xlsx` };
    }
    if (tab === 'sales') {
      const summary = [
        kv(t('reports.netSales'), data.net, { bold: true }),
        kv(t('reports.grossSales'), data.gross),
        kv(t('reports.discounts'), data.discounts),
        kv(t('reports.returns'), data.returnsTotal),
      ];
      return {
        sheets: [
          kvSheet(ar ? 'الملخص' : 'Summary', summary),
          { name: ar ? 'حسب التاريخ' : 'By Date', columns: dateColumns, rows: data.byDate },
          {
            name: ar ? 'حسب المنتج' : 'By Product',
            columns: [
              { header: ar ? 'المنتج' : 'Product', key: 'name', width: 28, wrap: true },
              { header: ar ? 'الكمية المباعة' : 'Units Sold', key: 'qty', width: 14, type: 'int' },
              { header: ar ? 'الإيراد' : 'Revenue', key: 'revenue', width: 16, type: 'currency' },
            ],
            rows: data.byProduct,
          },
          {
            name: ar ? 'حسب الفئة' : 'By Category',
            columns: [
              { header: ar ? 'الفئة' : 'Category', key: 'category', width: 22 },
              { header: ar ? 'الإيراد' : 'Revenue', key: 'revenue', width: 16, type: 'currency' },
            ],
            rows: data.byCategory,
          },
        ],
        fileName: `sales_${stamp}.xlsx`,
      };
    }
    if (tab === 'payments') {
      const summary = [
        kv(t('reports.totalPayments'), data.totalIn, { bold: true }),
        kv(t('reports.completed'), data.completed),
        kv(t('reports.pending'), data.pending),
        kv(t('reports.failed'), data.failed),
        kv(t('reports.supplierPaymentsOut'), data.supplierOut),
      ];
      return {
        sheets: [
          kvSheet(ar ? 'الملخص' : 'Summary', summary),
          { name: ar ? 'حسب التاريخ' : 'By Date', columns: dateColumns, rows: data.byDate },
          {
            name: ar ? 'حسب طريقة الدفع' : 'By Method',
            columns: [
              { header: ar ? 'الطريقة' : 'Method', key: 'method', width: 18 },
              { header: ar ? 'عدد العمليات' : 'Count', key: 'count', width: 12, type: 'int' },
              { header: ar ? 'الإجمالي' : 'Total', key: 'total', width: 16, type: 'currency' },
            ],
            rows: data.byMethod,
          },
        ],
        fileName: `payments_${stamp}.xlsx`,
      };
    }
    if (tab === 'expenses') {
      const summary = [kv(t('reports.totalExpenses'), data.total, { bold: true })];
      return {
        sheets: [
          kvSheet(ar ? 'الملخص' : 'Summary', summary),
          { name: ar ? 'حسب التاريخ' : 'By Date', columns: dateColumns, rows: data.byDate },
          {
            name: ar ? 'حسب الفئة' : 'By Category',
            columns: [
              { header: ar ? 'الفئة' : 'Category', key: 'name', width: 22 },
              { header: ar ? 'العدد' : 'Count', key: 'count', width: 12, type: 'int' },
              { header: ar ? 'الإجمالي' : 'Total', key: 'total', width: 16, type: 'currency' },
            ],
            rows: data.byCategory.map((c) => ({
              name: c.name ? (ar ? c.name : (c.name_en || c.name)) : t('expenses.uncategorized'),
              count: c.count,
              total: c.total,
            })),
          },
          {
            name: ar ? 'حسب طريقة الدفع' : 'By Method',
            columns: [
              { header: ar ? 'الطريقة' : 'Method', key: 'method', width: 18 },
              { header: ar ? 'الإجمالي' : 'Total', key: 'total', width: 16, type: 'currency' },
            ],
            rows: data.byMethod,
          },
        ],
        fileName: `expenses_${stamp}.xlsx`,
      };
    }
    // purchases
    const summary = [kv(t('reports.totalPurchases'), data.total, { bold: true })];
    return {
      sheets: [
        kvSheet(ar ? 'الملخص' : 'Summary', summary),
        { name: ar ? 'حسب التاريخ' : 'By Date', columns: dateColumns, rows: data.byDate },
        {
          name: ar ? 'حسب المورد' : 'By Supplier',
          columns: [
            { header: ar ? 'المورد' : 'Supplier', key: 'supplier', width: 22 },
            { header: ar ? 'الإجمالي' : 'Total', key: 'total', width: 16, type: 'currency' },
          ],
          rows: data.bySupplier,
        },
        {
          name: ar ? 'حسب المنتج' : 'By Product',
          columns: [
            { header: ar ? 'المنتج' : 'Product', key: 'name', width: 28, wrap: true },
            { header: ar ? 'الكمية' : 'Qty', key: 'qty', width: 12, type: 'int' },
            { header: ar ? 'التكلفة' : 'Cost', key: 'cost', width: 16, type: 'currency' },
          ],
          rows: data.byProduct,
        },
      ],
      fileName: `purchases_${stamp}.xlsx`,
    };
  };

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

        <div className="mt-6 flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0 overflow-x-auto">
            <PeriodSelector period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
          </div>
          {!loading && <ExportExcelButton getSheets={getReportSheets} className="shrink-0" />}
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : tab === 'pnl' ? (
          <ProfitLossPanel data={data} />
        ) : tab === 'sales' ? (
          <SalesPanel data={data} />
        ) : tab === 'payments' ? (
          <PaymentsPanel data={data} />
        ) : tab === 'expenses' ? (
          <ExpensesPanel data={data} />
        ) : (
          <PurchasesPanel data={data} />
        )}
      </div>
      <Footer />
    </div>
  );
}