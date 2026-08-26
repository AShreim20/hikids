import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import OrderTimeline from '@/components/orders/OrderTimeline';
import OrderActivityLog from '@/components/orders/OrderActivityLog';
import OrderItemsList from '@/components/orders/OrderItemsList';
import OrderFinancials from '@/components/orders/OrderFinancials';
import ContactCustomer from '@/components/orders/ContactCustomer';
import StatusChanger from '@/components/orders/StatusChanger';
import OrderEditPanel from '@/components/orders/OrderEditPanel';
import InvoiceButton from '@/components/orders/OrderInvoice';
import { usePermissions } from '@/lib/permissions';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import {
  orderRef, statusLabel, statusColor, normalizeStatus,
  logEntry, appendActivity, isWorkflowOverride,
} from '@/lib/orderStatus';

export default function OrderDetail() {
  const { id } = useParams();
  const { user, can, isOwner } = usePermissions();
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allowed = can('orders.manage');

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    base44.entities.Order.get(id)
      .then(async (o) => {
        setOrder(o);
        if (o?.customer_email) {
          const all = await base44.entities.Order.filter({ customer_email: o.customer_email }, '-created_date', 20).catch(() => []);
          setHistory(all.filter((x) => x.id !== o.id));
        }
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
    base44.entities.DeliveryCity.filter({ active: true })
      .then((list) => setCities(list.map((c) => c.name)))
      .catch(() => {});
  }, [id, allowed]);

  const actor = user?.full_name || user?.email || '';

  const persist = async (patch, entry) => {
    setSaving(true);
    try {
      const updated = await base44.entities.Order.update(order.id, {
        ...patch,
        handled_by: user?.email || order.handled_by,
        activity: appendActivity(order, entry),
      });
      setOrder(updated);
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
    } catch {
      toast({ title: ar ? 'تعذّر الحفظ' : 'Could not save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Loyalty follows the order lifecycle: points land on delivery and are
  // reversed (earned clawed back, spent refunded) on cancellation / return.
  const syncLoyalty = async (to) => {
    try {
      if (!['cancelled', 'returned', 'return_approved'].includes(to)) {
        // The server decides whether the reward is now available or still pending.
        const res = await base44.functions.invoke('awardLoyaltyPoints', { order_id: order.id });
        if (res?.awarded > 0) {
          toast({ title: ar ? `تم إضافة ${res.awarded} نقطة للزبون` : `${res.awarded} points credited to the customer` });
        }
      } else {
        const res = await base44.functions.invoke('reverseOrderLoyalty', { order_id: order.id });
        if (res?.reversed || res?.refunded) {
          toast({ title: ar ? 'تم تسوية نقاط الولاء لهذا الطلب' : 'Loyalty points settled for this order' });
        }
        base44.functions.invoke('reverseWheelRewards', { order_id: order.id }).catch(() => {});
      }
    } catch {
      // non-blocking: the status change itself already succeeded
    }
  };

  const changeStatus = async (to, { override } = {}) => {
    const from = normalizeStatus(order.status);
    await persist(
      { status: to },
      logEntry({
        action: 'status',
        from,
        to,
        by: actor,
        note: override || isWorkflowOverride(from, to) ? (ar ? 'تغيير خارج المسار الطبيعي' : 'Workflow override') : '',
      })
    );
    await syncLoyalty(to);
  };

  const saveEdits = (patch, note) => {
    const action = 'payment_status' in patch && Object.keys(patch).length === 1 ? 'payment_status' : 'delivery';
    persist(
      patch,
      logEntry({
        action,
        from: action === 'payment_status' ? order.payment_status || 'unpaid' : '',
        to: action === 'payment_status' ? patch.payment_status : '',
        by: actor,
        note,
      })
    );
  };

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={ar ? 'الطلب' : 'Order'} />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{ar ? 'غير مصرَّح' : 'Not authorized'}</h1>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="w-8 h-8 border-4 border-mist border-t-cosmic rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={ar ? 'الطلب' : 'Order'} />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-3xl">{ar ? 'الطلب غير موجود' : 'Order not found'}</h1>
          <Link to="/orders-admin" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {ar ? 'كل الطلبات' : 'All orders'}
          </Link>
        </div>
      </div>
    );
  }

  const created = new Date(order.created_date);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={`#${orderRef(order)}`} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <Link to="/orders-admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {ar ? 'كل الطلبات' : 'All orders'}
        </Link>

        <div className="mt-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl">#{orderRef(order)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {created.toLocaleDateString(ar ? 'ar' : 'en')} · {created.toLocaleTimeString(ar ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}
              {order.handled_by ? ` · ${ar ? 'يعالجه' : 'Handled by'}: ${order.handled_by}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold ${statusColor(order.status)}`}>
              {statusLabel(order.status, lang)}
            </span>
            {can('invoices.create') && <InvoiceButton order={order} />}
          </div>
        </div>

        <div className="mt-8 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <OrderItemsList order={order} />
            <OrderFinancials order={order} />

            <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6 grid sm:grid-cols-2 gap-5">
              <div>
                <h2 className="font-heading font-extrabold text-xl">{ar ? 'بيانات الزبون' : 'Customer'}</h2>
                {can('customers.manage') ? (
                  <div className="mt-3 text-sm space-y-1">
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-muted-foreground">{order.phone}</p>
                    <p className="text-muted-foreground">{order.customer_email}</p>
                    <p className="text-muted-foreground">
                      {ar ? 'طلبات سابقة' : 'Previous orders'}: {history.length}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {ar ? 'لا تملك صلاحية عرض بيانات الزبون.' : 'You cannot view customer information.'}
                  </p>
                )}
              </div>
              <div>
                <h2 className="font-heading font-extrabold text-xl">{ar ? 'التوصيل' : 'Delivery'}</h2>
                <div className="mt-3 text-sm space-y-1">
                  <p className="font-medium">{order.city || '—'}</p>
                  <p className="text-muted-foreground">{order.address || '—'}</p>
                  <p className="text-muted-foreground">
                    {ar ? 'أجرة التوصيل' : 'Delivery fee'}: {formatPrice(order.delivery_cost || 0)}
                  </p>
                  {order.delivery_notes && <p className="text-muted-foreground">{order.delivery_notes}</p>}
                  <p className="text-muted-foreground">
                    {ar ? 'طريقة الدفع' : 'Payment'}: {order.payment_method} · {order.payment_status || 'unpaid'}
                  </p>
                </div>
              </div>
              {order.gift_message && (
                <div className="sm:col-span-2 rounded-2xl bg-mist p-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    {ar ? 'رسالة الهدية' : 'Gift message'}
                  </p>
                  <p className="mt-1 text-sm italic">"{order.gift_message}"</p>
                </div>
              )}
            </div>

            <OrderEditPanel
              order={order}
              cities={cities.length ? cities : [order.city].filter(Boolean)}
              onSave={saveEdits}
              saving={saving}
              canEditCustomer={can('customers.manage')}
            />
            <OrderActivityLog order={order} />
          </div>

          <div className="space-y-6">
            <StatusChanger order={order} isOwner={isOwner} onChange={changeStatus} saving={saving} />
            <OrderTimeline order={order} />
            {can('customers.manage') && <ContactCustomer order={order} />}
            {history.length > 0 && can('customers.manage') && (
              <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
                <h2 className="font-heading font-extrabold text-xl">{ar ? 'سجل طلبات الزبون' : 'Customer order history'}</h2>
                <div className="mt-3 space-y-2">
                  {history.map((h) => (
                    <Link key={h.id} to={`/orders-admin/${h.id}`} className="flex justify-between text-sm hover:text-cosmic">
                      <span>#{orderRef(h)}</span>
                      <span className="font-heading font-bold">{formatPrice(h.total)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}