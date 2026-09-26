import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Package } from 'lucide-react';
import { db } from '@/api/entities';
import { subscribeOrders } from '@/lib/orderRealtime';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import OrderStatsCards from '@/components/orders/OrderStatsCards';
import OrderFilters from '@/components/orders/OrderFilters';
import OrderListItem from '@/components/orders/OrderListItem';
import { PreviewInvoiceButton } from '@/components/orders/OrderInvoice';
import { usePermissions } from '@/lib/permissions';
import { useLanguage } from '@/context/LanguageContext';
import {
  MAIN_FLOW, RETURN_STATUSES, normalizeStatus, statusLabel, orderRef,
} from '@/lib/orderStatus';
import { buildProductMap, lineCogs } from '@/lib/reports';
import { lineItemName } from '@/lib/bilingual';
import { fetchAllRows, toExcelDate, todayStamp } from '@/lib/excelExportHelpers';
import ExportExcelButton from '@/components/admin/ExportExcelButton';
import { useAdminLoadGuard } from '@/hooks/useAdminLoadGuard';
import AdminLoadFailed from '@/components/admin/AdminLoadFailed';

const TABS = ['all', ...MAIN_FLOW, 'cancelled', 'returns'];

export default function OrdersManagement() {
  const { can } = usePermissions();
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState({
    q: '', city: '', payment: '', paymentStatus: '', from: '', to: '', sort: 'newest',
  });
  // Deep link from User Management's "View Details" drawer: filters to one
  // customer's orders by their stable id, not by email/phone text search —
  // customer_email is often blank on an order (checkout doesn't always
  // collect a separate one), so an id match is the only reliable link.
  const [filterUser, setFilterUser] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('u');
    return id ? { id, name: params.get('name') || id } : null;
  });

  const allowed = can('orders.manage');
  const { failure, guard } = useAdminLoadGuard();

  const loadOrders = () => {
    setLoading(true);
    return guard(() => db.Order.list('-created_date', 500))
      .then((rows) => { if (rows) setOrders(rows); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    loadOrders();
    const unsubscribe = subscribeOrders((event) => {
      if (event.type === 'create') setOrders((prev) => [event.data, ...prev]);
      if (event.type === 'update') setOrders((prev) => prev.map((o) => (o.id === event.data.id ? event.data : o)));
      if (event.type === 'delete') setOrders((prev) => prev.filter((o) => o.id !== event.id));
    });
    return unsubscribe;
  }, [allowed]);

  const cities = useMemo(
    () => Array.from(new Set(orders.map((o) => o.city).filter(Boolean))),
    [orders]
  );

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let list = orders.filter((o) => {
      if (filterUser && o.created_by_id !== filterUser.id) return false;
      const s = normalizeStatus(o.status);
      if (tab === 'returns' && !RETURN_STATUSES.includes(s)) return false;
      if (tab !== 'all' && tab !== 'returns' && s !== tab) return false;
      if (filters.city && o.city !== filters.city) return false;
      if (filters.payment && o.payment_method !== filters.payment) return false;
      if (filters.paymentStatus && (o.payment_status || 'unpaid') !== filters.paymentStatus) return false;
      if (filters.from && new Date(o.created_date) < new Date(filters.from)) return false;
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.created_date) > end) return false;
      }
      if (q) {
        const hay = [
          o.id, o.customer_name, o.phone, o.customer_email, o.city,
          ...(o.items || []).map((i) => i.name),
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const by = {
      newest: (a, b) => new Date(b.created_date) - new Date(a.created_date),
      oldest: (a, b) => new Date(a.created_date) - new Date(b.created_date),
      total_desc: (a, b) => Number(b.total || 0) - Number(a.total || 0),
      total_asc: (a, b) => Number(a.total || 0) - Number(b.total || 0),
      status: (a, b) => normalizeStatus(a.status).localeCompare(normalizeStatus(b.status)),
      customer: (a, b) => String(a.customer_name || '').localeCompare(String(b.customer_name || '')),
    };
    return [...list].sort(by[filters.sort] || by.newest);
  }, [orders, tab, filters, filterUser]);

  // ── Excel export ──────────────────────────────────────────────────────
  // Two sheets (task §6, preferred over one summarized row): Orders, and
  // Order Items for line-level detail. Cost/Profit reuse reports.js's own
  // lineCogs() — the exact same per-line COGS math salesReport()/
  // profitLoss() already use — so this can never disagree with the Reports
  // page. Order Items has no "Discount" column: a line's `price` is already
  // the final effective per-unit price (order-level coupon/loyalty
  // discounts are their own columns on the Orders sheet), so there is no
  // separate real per-line discount value to report — better to omit the
  // column than fabricate one.
  const paymentLabel = (m) => (m === 'card' ? t('checkout.card') : m === 'cod' ? t('checkout.cod') : m === 'loyalty' ? t('checkout.payWithPoints') : (m || ''));

  const orderColumns = [
    { header: ar ? 'رقم الطلب' : 'Order Number', key: 'ref', width: 14 },
    { header: ar ? 'تاريخ الطلب' : 'Order Date', key: 'date', width: 14, type: 'date' },
    { header: ar ? 'اسم العميل' : 'Customer Name', key: 'customer', width: 22, wrap: true },
    { header: ar ? 'الهاتف' : 'Phone', key: 'phone', width: 16 },
    { header: ar ? 'البريد الإلكتروني' : 'Email', key: 'email', width: 22 },
    { header: ar ? 'المدينة' : 'City', key: 'city', width: 14 },
    { header: ar ? 'عنوان التوصيل' : 'Delivery Address', key: 'address', width: 28, wrap: true },
    { header: ar ? 'حالة الطلب' : 'Order Status', key: 'status', width: 16 },
    { header: ar ? 'طريقة الدفع' : 'Payment Method', key: 'payment', width: 16 },
    { header: ar ? 'المجموع الفرعي' : 'Subtotal', key: 'subtotal', width: 14, type: 'currency' },
    { header: ar ? 'خصم الكوبون' : 'Coupon Discount', key: 'coupon_discount', width: 14, type: 'currency' },
    { header: ar ? 'نقاط الولاء المستخدمة' : 'Loyalty Points Used', key: 'loyalty_points', width: 16, type: 'int' },
    { header: ar ? 'خصم الولاء' : 'Loyalty Discount', key: 'loyalty_discount', width: 14, type: 'currency' },
    { header: ar ? 'رسوم التوصيل' : 'Delivery Fee', key: 'delivery_fee', width: 14, type: 'currency' },
    { header: ar ? 'الإجمالي' : 'Total', key: 'total', width: 14, type: 'currency' },
    { header: ar ? 'التكلفة' : 'Cost', key: 'cost', width: 14, type: 'currency' },
    { header: ar ? 'الربح' : 'Profit', key: 'profit', width: 14, type: 'currency' },
  ];
  const itemColumns = [
    { header: ar ? 'رقم الطلب' : 'Order Number', key: 'ref', width: 14 },
    { header: ar ? 'اسم المنتج' : 'Product Name', key: 'name', width: 26, wrap: true },
    { header: 'SKU', key: 'sku', width: 16 },
    { header: ar ? 'الباركود' : 'Barcode', key: 'barcode', width: 16 },
    { header: ar ? 'الكمية' : 'Quantity', key: 'qty', width: 10, type: 'int' },
    { header: ar ? 'سعر الوحدة' : 'Unit Price', key: 'unit_price', width: 14, type: 'currency' },
    { header: ar ? 'الإجمالي' : 'Line Total', key: 'line_total', width: 14, type: 'currency' },
    { header: ar ? 'تكلفة الوحدة' : 'Unit Cost', key: 'unit_cost', width: 14, type: 'currency' },
    { header: ar ? 'الربح' : 'Profit', key: 'profit', width: 14, type: 'currency' },
  ];

  const buildOrderRow = (o, productMap) => {
    const cost = (o.items || []).reduce((s, it) => s + lineCogs(it, productMap), 0);
    const total = Number(o.total) || 0;
    return {
      ref: orderRef(o),
      date: toExcelDate(o.created_date),
      customer: o.customer_name || '',
      phone: o.phone || '',
      email: o.customer_email || '',
      city: o.city || '',
      address: o.address || '',
      status: statusLabel(normalizeStatus(o.status), lang),
      payment: paymentLabel(o.payment_method),
      subtotal: Number(o.subtotal) || 0,
      coupon_discount: Number(o.discount_amount) || 0,
      loyalty_points: Number(o.loyalty_points) || 0,
      loyalty_discount: Number(o.loyalty_discount) || 0,
      delivery_fee: Number(o.delivery_cost) || 0,
      total,
      cost,
      profit: total - cost,
    };
  };
  const buildItemRows = (o, productMap) =>
    (o.items || []).map((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.price) || 0;
      const cost = lineCogs(it, productMap);
      return {
        ref: orderRef(o),
        name: lineItemName(it, lang),
        sku: it.sku || '',
        barcode: it.is_bundle ? '' : (productMap[it.id]?.barcode || ''),
        qty,
        unit_price: price,
        line_total: qty * price,
        unit_cost: qty > 0 ? cost / qty : 0,
        profit: qty * price - cost,
      };
    });

  const getOrderSheets = async (scope) => {
    const [allOrders, products] = await Promise.all([
      scope === 'all' ? fetchAllRows(db.Order, '-created_date') : Promise.resolve(orders),
      fetchAllRows(db.Product, '-updated_date'),
    ]);
    const productMap = buildProductMap(products);
    const rows = scope === 'all' ? allOrders : visible;
    return {
      sheets: [
        { name: ar ? 'الطلبات' : 'Orders', columns: orderColumns, rows: rows.map((o) => buildOrderRow(o, productMap)) },
        {
          name: ar ? 'عناصر الطلب' : 'Order Items',
          columns: itemColumns,
          rows: rows.flatMap((o) => buildItemRows(o, productMap)),
        },
      ],
      fileName: `orders_${todayStamp()}.xlsx`,
    };
  };

  if (failure) return <AdminLoadFailed failure={failure} onRetry={loadOrders} />;

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={ar ? 'الطلبات' : 'Orders'} />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">
            {ar ? 'غير مصرَّح' : 'Not authorized'}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {ar ? 'هذه الصفحة مخصصة للإدارة والموظفين المصرَّح لهم.' : 'This page is for admins and authorized staff.'}
          </p>
          <Link to="/" className="mt-6 inline-flex h-12 px-6 items-center rounded-full bg-cosmic text-white font-heading font-bold squish">
            {ar ? 'العودة للمتجر' : 'Back to store'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={ar ? 'الطلبات والمبيعات' : 'Orders & Sales'} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl">
              {ar ? 'الطلبات والمبيعات' : 'Orders & Sales'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {ar ? 'متابعة وإدارة كل طلبات الزبائن.' : 'Track and manage every customer order.'}
            </p>
          </div>
          <PreviewInvoiceButton />
        </div>

        {filterUser && (
          <div className="mt-5 flex items-center gap-2 flex-wrap px-4 py-2.5 rounded-2xl bg-cosmic/10 text-cosmic text-sm font-heading font-bold">
            {ar ? `تصفية حسب: ${filterUser.name}` : `Filtered to: ${filterUser.name}`}
            <button type="button" onClick={() => setFilterUser(null)} className="underline underline-offset-2 font-normal">
              {ar ? 'إزالة التصفية' : 'Clear filter'}
            </button>
          </div>
        )}

        <div className="mt-8">
          <OrderStatsCards orders={orders} active={tab} onPick={setTab} />
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={`shrink-0 h-10 px-4 rounded-full text-sm font-heading font-bold transition-colors ${
                tab === s ? 'bg-cosmic text-white' : 'bg-mist text-foreground hover:bg-cosmic/10'
              }`}
            >
              {s === 'all' ? (ar ? 'الكل' : 'All') : s === 'returns' ? (ar ? 'الإرجاع' : 'Returns') : statusLabel(s, lang)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <OrderFilters value={filters} onChange={setFilters} cities={cities} />
          </div>
          <ExportExcelButton getSheets={getOrderSheets} scopes={['filtered', 'all']} className="shrink-0" />
        </div>

        {loading ? (
          <div className="mt-6 grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-3xl bg-mist animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="mt-5 font-heading font-bold text-xl">
              {ar ? 'لا توجد طلبات مطابقة' : 'No matching orders'}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {visible.map((o) => (
              <OrderListItem key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}