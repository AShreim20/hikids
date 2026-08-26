import React, { useState } from 'react';
import { Printer, Eye } from 'lucide-react';
import { orderRef, orderTotals, statusLabel } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';
import { BUSINESS_PHONE_DISPLAY } from '@/lib/businessContact';
import { lineItemName } from '@/lib/bilingual';

const STORE = {
  name: 'HiKids',
  tagline: 'Gallery of Wonder',
  instagram: '@hi_kids.ps',
  website: 'hikids.base44.app',
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

const paymentStatusLabel = (status, lang) => {
  const ar = lang === 'ar';
  const map = { paid: ar ? 'مدفوع' : 'Paid', unpaid: ar ? 'غير مدفوع' : 'Unpaid', refunded: ar ? 'مسترجع' : 'Refunded', failed: ar ? 'فشل' : 'Failed' };
  return map[status] || esc(status || 'unpaid');
};

// Opens a print-ready branded invoice in a new window (print / save as PDF / reprint).
// Optimized for A4: brand accents that remain readable when printed, table header
// repeats across pages, and rows / totals never split across a page break.
export function printInvoice(order, { lang = 'en' } = {}) {
  const ar = lang === 'ar';
  const dir = ar ? 'rtl' : 'ltr';
  const { subtotal, delivery, discount, loyalty, total } = orderTotals(order);

  const items = order.items || [];
  const hasTax = items.some((it) => Number(it.tax || 0) > 0) || Number(order.tax_amount || 0) > 0;
  const taxTotal = hasTax
    ? items.reduce((s, it) => s + Number(it.tax || 0), 0) + Number(order.tax_amount || 0)
    : 0;

  const rows = items
    .map((it) => {
      const qty = Number(it.qty || 0);
      const price = Number(it.price || 0);
      const lineTotal = price * qty;
      const isReward = it.is_wheel_reward || price === 0;
      const original = Number(it.reward_price || 0);
      const rewardDiscount = isReward && original > 0 ? original * qty : 0;
      const lineDiscount = rewardDiscount + Number(it.discount_amount || 0);
      const lineTax = Number(it.tax || 0);

      const nameParts = [esc(lineItemName(it, lang))];
      if (it.variant_label) nameParts.push(`<div class="sub">${esc(it.variant_label)}</div>`);
      if (it.barcode) nameParts.push(`<div class="sub">${ar ? 'باركود' : 'Barcode'}: ${esc(it.barcode)}</div>`);
      if (isReward) nameParts.push(`<span class="tag">${ar ? 'مكافأة مجانية' : 'Free reward'}</span>`);
      const nameCell = nameParts.join('');

      const unitCell =
        isReward && original > 0
          ? `<span class="strike">${money(original)}</span> <span class="sub">${money(0)}</span>`
          : money(price);

      const discountCell = lineDiscount > 0 ? `−${money(lineDiscount)}` : '<span class="dim">—</span>';

      return `<tr>
        <td class="name">${nameCell}</td>
        <td class="code">${esc(it.sku || '—')}</td>
        <td class="num">${qty}</td>
        <td class="num">${unitCell}</td>
        <td class="num">${discountCell}</td>
        ${hasTax ? `<td class="num">${lineTax > 0 ? money(lineTax) : '<span class="dim">—</span>'}</td>` : ''}
        <td class="num bold">${money(lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const trow = (label, value, mod = '') =>
    `<div class="trow ${mod}"><span class="tl">${label}</span><span class="tv">${value}</span></div>`;

  const dt = order.created_date ? new Date(order.created_date) : null;
  const dateStr = dt
    ? dt.toLocaleDateString(ar ? 'ar' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
  const timeStr = dt
    ? dt.toLocaleTimeString(ar ? 'ar' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  const paid = order.payment_status === 'paid' ? total : 0;
  const remaining = Math.max(0, total - paid);

  const colCount = hasTax ? 7 : 6;

  const html = `<!doctype html><html dir="${dir}" lang="${ar ? 'ar' : 'en'}"><head>
  <meta charset="utf-8">
  <title>${STORE.name} — ${orderRef(order)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #241C3B; background: #EEEAEE; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { max-width: 186mm; margin: 0 auto; background: #fff; box-shadow: 0 4px 24px rgba(36,28,59,.10); border-radius: 10px; overflow: hidden; }
    .accent { height: 6px; background: linear-gradient(90deg, #5D3F85 0%, #7C5AA8 55%, #E2568B 100%); }
    .pad { padding: 22px 26px 26px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .brand { display: flex; align-items: center; gap: 16px; }
    .brand img { height: 92px; width: auto; }
    .brand .bt { display: flex; flex-direction: column; justify-content: center; }
    .brand h1 { margin: 0; font-size: 30px; font-weight: 800; letter-spacing: .5px; color: #3A2A63; }
    .brand .tag { font-size: 12px; color: #7C5AA8; margin-top: 3px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600; }
    .doc { text-align: end; }
    .doc .badge { display: inline-block; background: #5D3F85; color: #fff; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
    .doc .ref { margin-top: 10px; font-size: 22px; font-weight: 800; color: #241C3B; letter-spacing: .5px; }
    .doc .when { margin-top: 4px; font-size: 12px; color: #6B5E86; }
    .contact { margin-top: 8px; font-size: 12px; color: #4A3F63; line-height: 1.7; }
    .meta { display: flex; gap: 16px; margin-top: 22px; }
    .panel { flex: 1; border: 1px solid #E7E1F1; border-radius: 10px; padding: 14px 16px; background: #FBF9FE; break-inside: avoid; }
    .panel h3 { margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #5D3F85; font-weight: 800; padding-bottom: 8px; border-bottom: 1px solid #E7E1F1; }
    .panel .row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; line-height: 1.9; }
    .panel .row .k { color: #6B5E86; }
    .panel .row .v { color: #241C3B; font-weight: 600; text-align: end; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    thead { display: table-header-group; }
    thead th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; text-align: start; color: #fff; background: #5D3F85; padding: 10px 10px; border: 1px solid #5D3F85; }
    thead th.num { text-align: end; }
    tbody tr { break-inside: avoid; }
    tbody td { font-size: 12px; padding: 9px 10px; border: 1px solid #E7E1F1; vertical-align: top; color: #241C3B; }
    tbody tr:nth-child(even) td { background: #FAF7FE; }
    td.num { text-align: end; white-space: nowrap; }
    td.code { color: #6B5E86; font-size: 11px; white-space: nowrap; }
    td.name { width: 38%; }
    td.bold, .bold { font-weight: 700; }
    .sub { font-size: 10.5px; color: #8A7CA8; margin-top: 2px; }
    .dim { color: #B6ACCB; }
    .strike { text-decoration: line-through; color: #9A8DB5; margin-inline-end: 4px; }
    .tag { display: inline-block; background: #FCE7F0; color: #C13B73; border: 1px solid #F4C9DC; padding: 1px 7px; font-size: 9.5px; text-transform: uppercase; letter-spacing: .5px; border-radius: 999px; margin-top: 3px; font-weight: 700; }
    .totals { width: 100%; max-width: 320px; margin-inline-start: auto; margin-top: 18px; border: 1px solid #E7E1F1; border-radius: 10px; overflow: hidden; break-inside: avoid; }
    .trow { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 12.5px; background: #FBF9FE; }
    .trow .tl { color: #4A3F63; }
    .trow .tv { color: #241C3B; font-weight: 600; }
    .trow.minus .tv { color: #C13B73; }
    .grand { background: #5D3F85; }
    .grand .tl { color: #E9DEFB; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; }
    .grand .tv { color: #fff; font-size: 17px; font-weight: 800; }
    .due { background: #FCE7F0; }
    .due .tl { color: #C13B73; font-weight: 700; }
    .due .tv { color: #C13B73; font-weight: 800; }
    .notes { margin-top: 16px; font-size: 11.5px; color: #4A3F63; line-height: 1.6; }
    .notes .nb { font-weight: 700; color: #3A2A63; }
    .foot { margin-top: 22px; border-top: 1px solid #E7E1F1; padding-top: 16px; text-align: center; }
    .foot .thanks { font-size: 14px; font-weight: 800; color: #5D3F85; letter-spacing: .4px; }
    .foot .info { margin-top: 5px; font-size: 11.5px; color: #6B5E86; line-height: 1.7; }
    .foot .social { margin-top: 6px; font-size: 11px; color: #8A7CA8; letter-spacing: .5px; }
    @media print {
      body { background: #fff; }
      .sheet { max-width: none; box-shadow: none; border-radius: 0; }
      .pad { padding: 0; }
    }
  </style></head>
<body onload="window.print()">
  <div class="sheet">
    <div class="accent"></div>
    <div class="pad">
      <div class="head">
        <div class="brand">
          <img src="${STORE.logoUrl}" alt="${STORE.name}">
          <div class="bt">
            <h1>${STORE.name}</h1>
            <div class="tag">${STORE.tagline}</div>
            <div class="contact">${BUSINESS_PHONE_DISPLAY}<br>${STORE.website}</div>
          </div>
        </div>
        <div class="doc">
          <span class="badge">${ar ? 'فاتورة مبيعات' : 'Sales Invoice'}</span>
          <div class="ref">#${orderRef(order)}</div>
          <div class="when">${dateStr}${timeStr ? ` · ${timeStr}` : ''}</div>
        </div>
      </div>

      <div class="meta">
        <div class="panel">
          <h3>${ar ? 'تفاصيل الفاتورة' : 'Invoice details'}</h3>
          <div class="row"><span class="k">${ar ? 'رقم الفاتورة' : 'Invoice no.'}</span><span class="v">${orderRef(order)}</span></div>
          <div class="row"><span class="k">${ar ? 'التاريخ' : 'Date'}</span><span class="v">${dateStr}</span></div>
          ${timeStr ? `<div class="row"><span class="k">${ar ? 'الوقت' : 'Time'}</span><span class="v">${timeStr}</span></div>` : ''}
          <div class="row"><span class="k">${ar ? 'طريقة الدفع' : 'Payment'}</span><span class="v">${paymentLabel(order.payment_method, lang)}</span></div>
          <div class="row"><span class="k">${ar ? 'حالة الدفع' : 'Payment status'}</span><span class="v">${paymentStatusLabel(order.payment_status, lang)}</span></div>
          <div class="row"><span class="k">${ar ? 'حالة الطلب' : 'Order status'}</span><span class="v">${esc(statusLabel(order.status, lang))}</span></div>
          ${order.handled_by ? `<div class="row"><span class="k">${ar ? 'البائع' : 'Salesperson'}</span><span class="v">${esc(order.handled_by)}</span></div>` : ''}
        </div>
        <div class="panel">
          <h3>${ar ? 'بيانات العميل' : 'Bill to'}</h3>
          <div class="row"><span class="k">${ar ? 'الاسم' : 'Name'}</span><span class="v">${esc(order.customer_name || '—')}</span></div>
          <div class="row"><span class="k">${ar ? 'الهاتف' : 'Phone'}</span><span class="v">${esc(order.phone || '—')}</span></div>
          ${order.customer_email ? `<div class="row"><span class="k">${ar ? 'البريد' : 'Email'}</span><span class="v">${esc(order.customer_email)}</span></div>` : ''}
          ${order.city ? `<div class="row"><span class="k">${ar ? 'المدينة' : 'City'}</span><span class="v">${esc(order.city)}</span></div>` : ''}
          ${order.address ? `<div class="row"><span class="k">${ar ? 'العنوان' : 'Address'}</span><span class="v">${esc(order.address)}</span></div>` : ''}
        </div>
      </div>

      <table>
        <thead><tr>
          <th>${ar ? 'المنتج' : 'Product'}</th>
          <th>${ar ? 'الكود' : 'Code / SKU'}</th>
          <th class="num">${ar ? 'الكمية' : 'Qty'}</th>
          <th class="num">${ar ? 'سعر الوحدة' : 'Unit price'}</th>
          <th class="num">${ar ? 'الخصم' : 'Discount'}</th>
          ${hasTax ? `<th class="num">${ar ? 'الضريبة' : 'Tax'}</th>` : ''}
          <th class="num">${ar ? 'الإجمالي' : 'Line total'}</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="${colCount}" class="dim">${ar ? 'لا توجد عناصر' : 'No items'}</td></tr>`}</tbody>
      </table>

      <div class="totals">
        ${trow(ar ? 'المجموع الفرعي' : 'Subtotal', money(subtotal))}
        ${discount > 0 ? trow((ar ? 'الخصم' : 'Discount') + (order.discount_code ? ` · ${esc(order.discount_code)}` : ''), money(discount), 'minus') : ''}
        ${loyalty > 0 ? trow((ar ? 'نقاط الولاء' : 'Loyalty points') + (order.loyalty_points ? ` · ${order.loyalty_points}` : ''), money(loyalty), 'minus') : ''}
        ${trow(ar ? 'رسوم التوصيل' : 'Delivery', money(delivery))}
        ${hasTax ? trow(ar ? 'الضريبة' : 'Tax / VAT', money(taxTotal)) : ''}
        ${trow(ar ? 'الإجمالي النهائي' : 'Final total', money(total), 'grand')}
        ${trow(ar ? 'المبلغ المدفوع' : 'Amount paid', money(paid))}
        ${remaining > 0 ? trow(ar ? 'الرصيد المتبقي' : 'Balance due', money(remaining), 'due') : ''}
      </div>

      ${(order.gift_message || order.delivery_notes) ? `
      <div class="notes">
        ${order.gift_message ? `<div><span class="nb">${ar ? 'رسالة إهداء:' : 'Gift message:'}</span> ${esc(order.gift_message)}</div>` : ''}
        ${order.delivery_notes ? `<div><span class="nb">${ar ? 'ملاحظات التوصيل:' : 'Delivery notes:'}</span> ${esc(order.delivery_notes)}</div>` : ''}
      </div>` : ''}

      <div class="foot">
        <div class="thanks">${ar ? 'شكراً لتسوقكم من HiKids' : 'Thank you for shopping at HiKids'}</div>
        <div class="info">${BUSINESS_PHONE_DISPLAY} · ${ar ? 'تواصل معنا للاستفسار والدعم' : 'Contact us for inquiries and support'}</div>
        <div class="social">${STORE.instagram} · ${STORE.website}</div>
      </div>
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

// Demo data used only for invoice preview — never persisted, never confused
// with a real transaction. The `_is_preview` flag and PREVIEW* id mark it.
const SAMPLE_ITEMS = [
  { name: 'سيارة سباق يتم التحكم بها عن بعد', name_en: 'RC Race Car Pro', sku: 'HK-RC-014', barcode: '6290123400011', price: 149, qty: 1 },
  { name: 'مجموعة مكعبات بناء 220 قطعة', name_en: 'Building Blocks 220pc', sku: 'HK-BLK-220', barcode: '6290123400028', price: 89, qty: 2 },
  { name: 'دمية دب قطني ناعم', name_en: 'Plush Teddy Bear', sku: 'HK-PL-009', barcode: '6290123400035', price: 65, qty: 1 },
  { name: 'لوح رسم مغناطيسي ثنائي الوجه', name_en: 'Magnetic Drawing Board', sku: 'HK-DB-007', barcode: '6290123400042', price: 110, qty: 1 },
  { name: 'بازل صخري 100 قطعة', name_en: 'Dinosaur Puzzle 100pc', sku: 'HK-PZ-100', barcode: '6290123400059', price: 45, qty: 3 },
  { name: 'قطار خشبي كلاسيكي - مجموعة 40 قطعة', name_en: 'Wooden Train Set 40pc', sku: 'HK-TR-040', barcode: '6290123400066', price: 130, qty: 1 },
  { name: 'كرة قدم مضيئة بال_LED', name_en: 'LED Light Football', sku: 'HK-BL-021', barcode: '6290123400073', price: 75, qty: 2 },
  { name: 'ميكروسكوب علمي للأطفال', name_en: 'Kids Microscope', sku: 'HK-SC-003', barcode: '6290123400080', price: 199, qty: 1 },
  { name: 'لوحة ألوان وفرو شعر', name_en: 'Watercolor Paint Set', sku: 'HK-AR-018', barcode: '6290123400097', price: 58, qty: 2 },
  { name: 'روبوت برمجي تفاعلي', name_en: 'Coding Robot Kit', sku: 'HK-RB-001', barcode: '6290123400103', price: 240, qty: 1 },
  { name: 'مطبخ ألعاب كامل بالملحقات', name_en: 'Play Kitchen Deluxe', sku: 'HK-KT-005', barcode: '6290123400110', price: 320, qty: 1 },
  { name: 'دراجة ثلاثية العجلات حمراء', name_en: 'Red Tricycle', sku: 'HK-TR-005', barcode: '6290123400127', price: 280, qty: 1 },
  { name: 'مجموعة طباعة ديناصورات', name_en: 'Dinosaur Stamp Set', sku: 'HK-ST-012', barcode: '6290123400134', price: 38, qty: 2 },
  { name: 'جيتار صغير موسيقي للأطفال', name_en: 'Kids Acoustic Guitar', sku: 'HK-MU-006', barcode: '6290123400141', price: 145, qty: 1 },
  { name: 'لعبة تركيب شرطة المرور', name_en: 'Traffic Lego Set', sku: 'HK-LG-031', barcode: '6290123400158', price: 95, qty: 1 },
  { name: 'مكعبات رياضيات تعليمية', name_en: 'Math Learning Cubes', sku: 'HK-ED-022', barcode: '6290123400165', price: 52, qty: 3 },
  { name: 'ساعة يد رقمية للأطفال', name_en: 'Kids Digital Watch', sku: 'HK-WT-008', barcode: '6290123400172', price: 70, qty: 2 },
  { name: 'طاولة ونشاطات متعددة', name_en: 'Activity Play Table', sku: 'HK-AT-001', barcode: '6290123400189', price: 210, qty: 1 },
];

// Opens the real invoice template with mock data. Print / Save-as-PDF behave
// exactly like a live invoice. Nothing is written to the database.
export function previewSampleInvoice({ lang = 'en' } = {}) {
  const ar = lang === 'ar';
  const items = SAMPLE_ITEMS.map((p) => {
    const line = p.price * p.qty;
    const tax = Math.round(line * 0.16 * 100) / 100;
    return { ...p, tax };
  });
  // A free wheel-reward line to exercise the reward / strike-through styling.
  items.push({
    name: 'مكافأة العجلة السحرية', name_en: 'Mystery Wheel Reward',
    sku: 'HK-RWD', barcode: '6290000000001', price: 0, qty: 1,
    is_wheel_reward: true, reward_price: 89, tax: 0,
  });

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const taxTotal = items.reduce((s, it) => s + Number(it.tax || 0), 0);
  const discount_amount = 25;
  const loyalty_discount = 20;
  const loyalty_points = 200;
  const delivery_cost = 30;
  const total = subtotal + taxTotal + delivery_cost - discount_amount - loyalty_discount;

  const order = {
    _is_preview: true,
    id: 'PREVIEW0001',
    created_date: new Date().toISOString(),
    payment_method: 'card',
    payment_status: 'paid',
    status: 'delivered',
    handled_by: 'ahmad@hikids.ps',
    customer_name: ar ? 'نور إبراهيم' : 'Noor Ibrahim',
    phone: '+970 59 123 4567',
    customer_email: 'noor@example.com',
    city: ar ? 'رام الله' : 'Ramallah',
    address: ar ? 'شارع الماصون، بجانب البنك العربي' : 'Al-Masoun St., next to Arab Bank',
    subtotal,
    delivery_cost,
    discount_code: 'WELCOME10',
    discount_amount,
    loyalty_points,
    loyalty_discount,
    total,
    gift_message: ar ? 'كل عام وأنتم بخير — هدية للعيد!' : 'Wishing you a wonderful birthday!',
    delivery_notes: ar ? 'الرجاء الاتصال قبل التوصيل بـ 15 دقيقة.' : 'Please call 15 minutes before delivery.',
    items,
  };

  printInvoice(order, { lang });
}

export function PreviewInvoiceButton() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="squish inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-sm"
      >
        <Eye className="w-4 h-4" /> {ar ? 'معاينة الفاتورة' : 'Preview Invoice'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl bg-card border border-border shadow-xl py-1.5">
            <button
              type="button"
              onClick={() => { previewSampleInvoice({ lang: 'en' }); setOpen(false); }}
              className="w-full text-start px-4 py-2.5 text-sm hover:bg-mist"
            >
              English (LTR)
            </button>
            <button
              type="button"
              onClick={() => { previewSampleInvoice({ lang: 'ar' }); setOpen(false); }}
              className="w-full text-start px-4 py-2.5 text-sm hover:bg-mist"
            >
              العربية (RTL)
            </button>
          </div>
        </>
      )}
    </div>
  );
}