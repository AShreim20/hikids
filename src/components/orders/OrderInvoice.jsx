import React from 'react';
import { Printer } from 'lucide-react';
import { orderRef, orderTotals, statusLabel } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';
import { BUSINESS_PHONE, BUSINESS_PHONE_DISPLAY } from '@/lib/businessContact';
import { lineItemName } from '@/lib/bilingual';

const STORE = {
  name: 'HiKids',
  tagline: 'Gallery of Wonder',
  instagram: '@hi_kids.ps',
  logoUrl:
    'https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/d7ed46244_1000016311-removebg-preview.png',
};

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = (n) => `₪${Number(n || 0).toFixed(2)}`;

const paymentLabel = (method, lang) => {
  const ar = lang === 'ar';
  if (method === 'card') return ar ? 'بطاقة' : 'Card';
  if (method === 'loyalty') return ar ? 'نقاط الولاء' : 'Loyalty points';
  return ar ? 'الدفع عند الاستلام' : 'Cash on delivery';
};

// Opens a print-ready invoice in a new window (print / save as PDF / reprint).
// Designed for A4, strictly black & white so it prints cleanly on any printer.
export function printInvoice(order, { lang = 'en' } = {}) {
  const ar = lang === 'ar';
  const dir = ar ? 'rtl' : 'ltr';
  const { subtotal, delivery, discount, loyalty, total } = orderTotals(order);

  const rows = (order.items || [])
    .map((it) => {
      const qty = Number(it.qty || 0);
      const price = Number(it.price || 0);
      const lineTotal = price * qty;
      const isReward = it.is_wheel_reward || price === 0;
      const original = Number(it.reward_price || 0);
      const rewardDiscount = isReward && original > 0 ? original * qty : 0;

      const nameCell =
        esc(lineItemName(it, lang)) +
        (it.variant_label ? `<br><small class="muted">${esc(it.variant_label)}</small>` : '') +
        (it.sku ? `<br><small class="muted">SKU: ${esc(it.sku)}</small>` : '') +
        (isReward ? `<br><small class="tag">${ar ? 'مكافأة مجانية' : 'Free reward'}</small>` : '');

      const unitCell = isReward && original > 0
        ? `<span class="strike">${money(original)}</span><br><small class="muted">${money(0)}</small>`
        : money(price);

      const discountCell = rewardDiscount > 0
        ? `−${money(rewardDiscount)}`
        : '<span class="muted">—</span>';

      return `<tr>
        <td class="name">${nameCell}</td>
        <td class="num">${qty}</td>
        <td class="num">${unitCell}</td>
        <td class="num">${discountCell}</td>
        <td class="num bold">${money(lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const totalsRow = (label, value, mod = '') =>
    `<div class="trow ${mod}"><span>${label}</span><span>${value}</span></div>`;

  const dateStr = order.created_date
    ? new Date(order.created_date).toLocaleDateString(ar ? 'ar' : 'en-GB', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : '—';

  const html = `<!doctype html><html dir="${dir}" lang="${ar ? 'ar' : 'en'}"><head>
  <meta charset="utf-8">
  <title>${STORE.name} — ${orderRef(order)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color:#000; background:#fff; margin:0; padding:0; }
    .sheet { max-width: 180mm; margin: 0 auto; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; border-bottom:2px solid #000; padding-bottom:14px; }
    .brand { display:flex; align-items:center; gap:12px; }
    .brand img { height:46px; width:auto; }
    .brand h1 { margin:0; font-size:22px; letter-spacing:.5px; }
    .brand .tag { font-size:11px; color:#444; margin-top:2px; }
    .doc-title { text-align:${ar ? 'left' : 'right'}; }
    .doc-title .label { font-size:20px; font-weight:800; text-transform:uppercase; letter-spacing:1px; }
    .doc-title .ref { font-size:13px; margin-top:4px; }
    .contact { font-size:12px; color:#222; line-height:1.5; margin-top:4px; }
    .meta { display:flex; justify-content:space-between; gap:24px; margin-top:18px; }
    .panel { flex:1; border:1px solid #000; padding:10px 12px; font-size:12px; line-height:1.6; }
    .panel h3 { margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:.6px; border-bottom:1px solid #000; padding-bottom:4px; }
    .panel .v { color:#000; }
    table { width:100%; border-collapse:collapse; margin-top:18px; }
    thead th { font-size:11px; text-transform:uppercase; letter-spacing:.4px; text-align:${ar ? 'right' : 'left'}; border:1px solid #000; padding:8px 10px; background:#fff; }
    thead th.num { text-align:${ar ? 'right' : 'right'}; }
    tbody td { font-size:12px; border:1px solid #000; padding:8px 10px; vertical-align:top; }
    td.num { text-align:${ar ? 'left' : 'right'}; white-space:nowrap; }
    td.name { width:44%; }
    td.bold, .bold { font-weight:700; }
    .muted { color:#555; font-size:11px; }
    .strike { text-decoration:line-through; color:#555; }
    .tag { display:inline-block; border:1px solid #000; padding:0 6px; font-size:10px; text-transform:uppercase; letter-spacing:.4px; margin-top:2px; }
    .totals { width:100%; max-width:340px; margin-${ar ? 'right' : 'left'}:auto; margin-top:16px; font-size:13px; }
    .trow { display:flex; justify-content:space-between; padding:5px 2px; }
    .trow.minus span:last-child::before { content:'−'; }
    .grand { border-top:2px solid #000; margin-top:6px; padding-top:8px; font-weight:800; font-size:16px; }
    .foot { margin-top:22px; border-top:1px solid #000; padding-top:10px; font-size:11px; color:#333; text-align:center; }
    .notes { margin-top:14px; font-size:11px; color:#333; }
    @media print { body { background:#fff; } .sheet { max-width:none; } }
  </style></head>
<body onload="window.print()">
  <div class="sheet">
    <div class="head">
      <div class="brand">
        <img src="${STORE.logoUrl}" alt="${STORE.name}">
        <div>
          <h1>${STORE.name}</h1>
          <div class="tag">${STORE.tagline} · ${STORE.instagram}</div>
          <div class="contact">${BUSINESS_PHONE_DISPLAY}</div>
        </div>
      </div>
      <div class="doc-title">
        <div class="label">${ar ? 'فاتورة مبيعات' : 'Sales Invoice'}</div>
        <div class="ref">#${orderRef(order)}</div>
      </div>
    </div>

    <div class="meta">
      <div class="panel">
        <h3>${ar ? 'الفاتورة' : 'Invoice'}</h3>
        <div class="v"><strong>${ar ? 'رقم' : 'No.'}:</strong> ${orderRef(order)}</div>
        <div class="v"><strong>${ar ? 'التاريخ' : 'Date'}:</strong> ${dateStr}</div>
        <div class="v"><strong>${ar ? 'طريقة الدفع' : 'Payment'}:</strong> ${paymentLabel(order.payment_method, lang)}</div>
        <div class="v"><strong>${ar ? 'الحالة' : 'Status'}:</strong> ${statusLabel(order.status, lang)}</div>
        <div class="v"><strong>${ar ? 'حالة الدفع' : 'Payment status'}:</strong> ${esc(order.payment_status || 'unpaid')}</div>
      </div>
      <div class="panel">
        <h3>${ar ? 'العميل' : 'Bill to'}</h3>
        <div class="v"><strong>${esc(order.customer_name || '—')}</strong></div>
        <div class="v">${esc(order.phone || '—')}</div>
        ${order.customer_email ? `<div class="v">${esc(order.customer_email)}</div>` : ''}
        ${order.address ? `<div class="v">${esc(order.address)}${order.city ? `, ${esc(order.city)}` : ''}</div>` : ''}
      </div>
    </div>

    <table>
      <thead><tr>
        <th>${ar ? 'المنتج' : 'Product'}</th>
        <th class="num">${ar ? 'الكمية' : 'Qty'}</th>
        <th class="num">${ar ? 'سعر الوحدة' : 'Unit price'}</th>
        <th class="num">${ar ? 'الخصم' : 'Discount'}</th>
        <th class="num">${ar ? 'الإجمالي' : 'Line total'}</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">${ar ? 'لا توجد عناصر' : 'No items'}</td></tr>`}</tbody>
    </table>

    <div class="totals">
      ${totalsRow(ar ? 'المجموع الفرعي' : 'Subtotal', money(subtotal))}
      ${discount > 0 ? totalsRow((ar ? 'كود الخصم' : 'Discount code') + (order.discount_code ? ` (${esc(order.discount_code)})` : ''), money(discount), 'minus') : ''}
      ${loyalty > 0 ? totalsRow(ar ? 'نقاط الولاء' + (order.loyalty_points ? ` (${order.loyalty_points})` : '') : 'Loyalty points' + (order.loyalty_points ? ` (${order.loyalty_points})` : ''), money(loyalty), 'minus') : ''}
      ${totalsRow(ar ? 'التوصيل' : 'Delivery', money(delivery))}
      ${totalsRow(ar ? 'الإجمالي النهائي' : 'Final total', money(total), 'grand')}
    </div>

    ${order.gift_message ? `<div class="notes"><strong>${ar ? 'رسالة إهداء:' : 'Gift message:'}</strong> ${esc(order.gift_message)}</div>` : ''}
    ${order.delivery_notes ? `<div class="notes"><strong>${ar ? 'ملاحظات التوصيل:' : 'Delivery notes:'}</strong> ${esc(order.delivery_notes)}</div>` : ''}

    <div class="foot">
      ${ar ? 'شكراً لتسوقكم من HiKids · للاستفسار ' : 'Thank you for shopping at HiKids · For inquiries '}${BUSINESS_PHONE_DISPLAY}
    </div>
  </div>
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