import { handlePreflight, json } from '../_shared/cors.ts';
import { serviceRoleClient } from '../_shared/client.ts';

// Sends an e-mail to the store admins when something needs their attention:
//   new_order · order_cancelled · new_return_request · new_review · new_challenge_submission
//
// Called ONLY by Postgres (pg_net, see migration 0067) with the header `x-notify-secret`. The secret lives in
// Supabase Vault and is compared here against public.get_admin_notify_secret(); the request body only carries
// {kind, id} — the content of the e-mail is always re-read from the database, never trusted from the request.
//
// Needs one Edge Function secret:  RESEND_API_KEY   (the same Resend account used for the auth e-mails).
// Optional secrets:
//   ORDER_EMAIL_FROM        default "HiKids <no-reply@hikids-ps.com>"  (any address on the verified domain)
//   ADMIN_NOTIFY_EMAILS     comma separated; overrides the automatic list (admin profiles + site contact e-mail)
//   SITE_URL                default https://www.hikids-ps.com

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://www.hikids-ps.com').replace(/\/$/, '');
const FROM = Deno.env.get('ORDER_EMAIL_FROM') || 'HiKids <no-reply@hikids-ps.com>';

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n: unknown) => `${Number(n || 0).toFixed(2)} ₪`;
const orderRef = (id: string) => `ORD-${String(id).slice(-6).toUpperCase()}`;

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const PAYMENT: Record<string, string> = { cod: 'الدفع عند الاستلام', card: 'بطاقة', cash: 'نقداً' };

function layout(title: string, color: string, rows: Array<[string, string]>, extra: string, link: { url: string; label: string }) {
  const tr = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:8px 12px;color:#6b5a85;white-space:nowrap;vertical-align:top;font-size:14px">${esc(k)}</td><td style="padding:8px 12px;color:#2a1850;font-size:15px;font-weight:600">${v}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f3eefa;font-family:Tahoma,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:18px">
    <div style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 18px rgba(60,30,100,.12)">
      <div style="background:${color};color:#fff;padding:20px 22px;font-size:20px;font-weight:800">${esc(title)}</div>
      <table style="width:100%;border-collapse:collapse;margin:8px 0">${tr}</table>
      ${extra}
      <div style="padding:18px 22px 24px;text-align:center">
        <a href="${esc(link.url)}" style="display:inline-block;background:#5D3F85;color:#fff;text-decoration:none;font-weight:800;padding:12px 28px;border-radius:999px;font-size:15px">${esc(link.label)}</a>
      </div>
    </div>
    <p style="text-align:center;color:#8a7aa3;font-size:12px;margin:14px 0 0">HiKids · إشعار تلقائي للإدارة</p>
  </div></body></html>`;
}

async function buildEmail(service: ReturnType<typeof serviceRoleClient>, kind: string, id: string) {
  if (kind === 'new_order' || kind === 'order_cancelled') {
    const { data: o } = await service.from('orders').select('*').eq('id', id).maybeSingle();
    if (!o) return null;
    const items = Array.isArray(o.items) ? o.items : [];
    const lines = items
      .map((it: any) => {
        const qty = Number(it.qty) || 1;
        const tag = it.is_wheel_reward ? ' (جائزة العجلة)' : '';
        return `<tr><td style="padding:6px 22px;font-size:14px;color:#2a1850">${esc(it.name || it.name_en || '')}${esc(tag)}${it.variant_label ? ` — ${esc(it.variant_label)}` : ''}</td><td style="padding:6px 8px;font-size:14px;color:#6b5a85;white-space:nowrap">× ${qty}</td><td style="padding:6px 22px;font-size:14px;color:#2a1850;white-space:nowrap;text-align:left">${money(Number(it.price || 0) * qty)}</td></tr>`;
      })
      .join('');
    const itemsHtml = `<div style="border-top:1px solid #eee;margin-top:6px"><div style="padding:12px 22px 4px;color:#6b5a85;font-size:13px;font-weight:700">المنتجات</div><table style="width:100%;border-collapse:collapse">${lines}</table></div>`;
    const cancelled = kind === 'order_cancelled';
    const rows: Array<[string, string]> = [
      ['رقم الطلب', esc(orderRef(o.id))],
      ['الزبون', esc(o.customer_name)],
      ['الهاتف', `<span dir="ltr">${esc(o.phone)}</span>`],
      ['المدينة', esc(o.city)],
      ['العنوان', esc(o.address)],
      ['المجموع الفرعي', money(o.subtotal)],
      ['التوصيل', money(o.delivery_cost)],
      ['خصم', Number(o.discount_amount) > 0 ? '-' + money(o.discount_amount) : ''],
      ['الإجمالي', `<span style="font-size:18px;color:#5D3F85">${money(o.total)}</span>`],
      ['الدفع', esc(PAYMENT[o.payment_method] || o.payment_method)],
      ['ملاحظة الزبون', esc(o.delivery_notes)],
      ['رسالة الهدية', esc(o.gift_message)],
    ];
    return {
      subject: `${cancelled ? '❌ تم إلغاء طلب' : '🛒 طلب جديد'} ${orderRef(o.id)} — ${money(o.total)}${o.city ? ' — ' + o.city : ''}`,
      html: layout(cancelled ? 'تم إلغاء طلب' : 'وصلك طلب جديد! 🎉', cancelled ? '#B3261E' : '#5D3F85', rows, itemsHtml, { url: `${SITE_URL}/orders-admin/${o.id}`, label: 'فتح الطلب بلوحة الإدارة' }),
    };
  }

  if (kind === 'new_return_request') {
    const { data: r } = await service.from('return_requests').select('*').eq('id', id).maybeSingle();
    if (!r) return null;
    const { data: o } = r.order_id ? await service.from('orders').select('id,customer_name,phone,total').eq('id', r.order_id).maybeSingle() : { data: null };
    const type = r.request_type === 'exchange' ? 'استبدال' : r.request_type === 'return' ? 'إرجاع' : String(r.request_type || '');
    const rows: Array<[string, string]> = [
      ['رقم الطلب', esc(r.request_code)],
      ['النوع', esc(type)],
      ['الطلب الأصلي', o ? esc(orderRef(o.id)) : ''],
      ['الزبون', esc(o?.customer_name)],
      ['الهاتف', o?.phone ? `<span dir="ltr">${esc(o.phone)}</span>` : ''],
      ['ملاحظة الزبون', esc(r.customer_note)],
    ];
    return {
      subject: `↩️ طلب ${type} جديد ${r.request_code || ''}`.trim(),
      html: layout(`طلب ${type} جديد`, '#E07B00', rows, '', { url: `${SITE_URL}/admin/return-requests/${r.id}`, label: 'مراجعة الطلب' }),
    };
  }

  if (kind === 'new_review') {
    const { data: rv } = await service.from('reviews').select('*').eq('id', id).maybeSingle();
    if (!rv) return null;
    const { data: p } = rv.product_id ? await service.from('products').select('name').eq('id', rv.product_id).maybeSingle() : { data: null };
    const rows: Array<[string, string]> = [
      ['المنتج', esc(p?.name)],
      ['التقييم', '⭐'.repeat(Math.max(0, Math.min(5, Number(rv.rating) || 0)))],
      ['الاسم', esc(rv.name)],
      ['التعليق', esc(rv.comment)],
      ['صورة', rv.photo_url ? 'مرفقة — بانتظار المراجعة' : ''],
    ];
    return {
      subject: `⭐ تقييم جديد بانتظار المراجعة${p?.name ? ' — ' + p.name : ''}`,
      html: layout('تقييم جديد بانتظار المراجعة', '#2E7D32', rows, '', { url: `${SITE_URL}/admin/photo-reviews`, label: 'مراجعة التقييمات' }),
    };
  }

  if (kind === 'new_challenge_submission') {
    const { data: s } = await service.from('challenge_submissions').select('*').eq('id', id).maybeSingle();
    if (!s) return null;
    const rows: Array<[string, string]> = [['المستخدم', esc(s.user_email || s.user_id)], ['الحالة', 'بانتظار المراجعة']];
    return {
      subject: '🏆 مشاركة جديدة بتحدٍّ بانتظار المراجعة',
      html: layout('مشاركة جديدة بتحدٍّ', '#1565C0', rows, '', { url: `${SITE_URL}/admin/challenges`, label: 'مراجعة المشاركات' }),
    };
  }
  return null;
}

async function recipients(service: ReturnType<typeof serviceRoleClient>) {
  const override = (Deno.env.get('ADMIN_NOTIFY_EMAILS') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (override.length) return override;
  const set = new Set<string>();
  const { data: admins } = await service.from('profiles').select('email').eq('role', 'admin');
  for (const a of admins || []) if (a.email) set.add(String(a.email).toLowerCase());
  const { data: site } = await service.from('site_settings').select('email').limit(1).maybeSingle();
  if (site?.email) set.add(String(site.email).toLowerCase());
  return [...set].filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    const service = serviceRoleClient();
    const given = req.headers.get('x-notify-secret') || '';
    const { data: secret } = await service.rpc('get_admin_notify_secret');
    if (!secret || !given || !safeEqual(String(secret), given)) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || '');
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Bad id' }, { status: 400 });

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('notifyAdmin: RESEND_API_KEY is not set — no e-mail sent');
      return json({ ok: false, reason: 'RESEND_API_KEY missing' });
    }

    const mail = await buildEmail(service, kind, id);
    if (!mail) return json({ ok: false, reason: 'nothing to send' });
    const to = await recipients(service);
    if (!to.length) return json({ ok: false, reason: 'no recipients' });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject: mail.subject, html: mail.html }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('notifyAdmin: Resend error', res.status, JSON.stringify(out));
      return json({ ok: false, reason: 'resend_error', status: res.status });
    }
    return json({ ok: true, to: to.length });
  } catch (error) {
    console.error('notifyAdmin failed:', (error as Error).message);
    return json({ ok: false, message: (error as Error).message }, { status: 500 });
  }
});
