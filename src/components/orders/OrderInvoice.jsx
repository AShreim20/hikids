import React from 'react';
import { Printer } from 'lucide-react';
import { orderRef, orderTotals, statusLabel } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';

const STORE = { name: 'HiKids', tagline: 'HiKids Toy Store', instagram: '@hi_kids.ps' };

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Opens a print-ready invoice in a new window (print / save as PDF / reprint).
export function printInvoice(order, { lang = 'en', currency = '$' } = {}) {
  const ar = lang === 'ar';
  const { subtotal, delivery, discount, loyalty, total } = orderTotals(order);
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;
  const rows = (order.items || [])
    .map(
      (it) => `<tr>
        <td>${esc(it.name)}${it.variant_label ? `<br><small>${esc(it.variant_label)}</small>` : ''}${it.sku ? `<br><small>SKU: ${esc(it.sku)}</small>` : ''}</td>
        <td>${esc(it.qty)}</td>
        <td>${money(it.price)}</td>
        <td>${money(Number(it.price || 0) * Number(it.qty || 0))}</td>
      </tr>`
    )
    .join('');

  const html = `<!doctype html><html dir="${ar ? 'rtl' : 'ltr'}" lang="${ar ? 'ar' : 'en'}"><head>
    <meta charset="utf-8"><title>${STORE.name} — ${orderRef(order)}</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:32px;color:#1a1a1e}
      h1{margin:0;font-size:24px} table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{text-align:${ar ? 'right' : 'left'};padding:8px;border-bottom:1px solid #e5e2dc;font-size:14px}
      .muted{color:#6b6660;font-size:13px} .totals{margin-top:16px;font-size:14px}
      .totals div{display:flex;justify-content:space-between;padding:4px 0}
      .grand{font-weight:800;font-size:18px;border-top:2px solid #1a1a1e;margin-top:8px;padding-top:8px}
    </style></head><body>
    <h1>${STORE.name}</h1>
    <p class="muted">${STORE.tagline} · ${STORE.instagram}</p>
    <hr>
    <p><strong>${ar ? 'فاتورة' : 'Invoice'} #${orderRef(order)}</strong><br>
      <span class="muted">${new Date(order.created_date).toLocaleString(ar ? 'ar' : 'en')}</span><br>
      <span class="muted">${ar ? 'الحالة' : 'Status'}: ${statusLabel(order.status, lang)}</span></p>
    <p><strong>${ar ? 'الزبون' : 'Customer'}</strong><br>
      ${esc(order.customer_name)}<br>${esc(order.phone)}<br>${esc(order.customer_email)}<br>
      ${esc(order.address)}${order.city ? `, ${esc(order.city)}` : ''}</p>
    <table><thead><tr>
      <th>${ar ? 'المنتج' : 'Product'}</th><th>${ar ? 'الكمية' : 'Qty'}</th>
      <th>${ar ? 'السعر' : 'Price'}</th><th>${ar ? 'الإجمالي' : 'Total'}</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div><span>${ar ? 'المجموع الفرعي' : 'Subtotal'}</span><span>${money(subtotal)}</span></div>
      ${discount > 0 ? `<div><span>${ar ? 'خصم' : 'Discount'}${order.discount_code ? ` (${esc(order.discount_code)})` : ''}</span><span>−${money(discount)}</span></div>` : ''}
      ${loyalty > 0 ? `<div><span>${ar ? 'نقاط الولاء' : 'Loyalty points'}</span><span>−${money(loyalty)}</span></div>` : ''}
      <div><span>${ar ? 'التوصيل' : 'Delivery'}</span><span>${money(delivery)}</span></div>
      <div class="grand"><span>${ar ? 'الإجمالي النهائي' : 'Final total'}</span><span>${money(total)}</span></div>
      <div><span>${ar ? 'طريقة الدفع' : 'Payment method'}</span><span>${esc(order.payment_method)}</span></div>
      <div><span>${ar ? 'حالة الدفع' : 'Payment status'}</span><span>${esc(order.payment_status || 'unpaid')}</span></div>
    </div>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export default function InvoiceButton({ order }) {
  const { lang } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => printInvoice(order, { lang })}
      className="squish inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-mist font-heading font-bold text-sm"
    >
      <Printer className="w-4 h-4" /> {lang === 'ar' ? 'طباعة الفاتورة' : 'Print invoice'}
    </button>
  );
}