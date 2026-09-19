-- Site-wide "Action Required": derived live from authoritative workflow state
-- (no task table, nothing to mark done -- completing the real action changes
-- the state and the item disappears or becomes the next required action).
-- Returns both audiences the caller is entitled to; each block is guarded by
-- the caller's own ownership / existing permission checks.
create or replace function public.action_required_items()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := coalesce(is_admin(), false);
  v_orders boolean; v_returns boolean; v_settle boolean; v_cust boolean; v_loy boolean;
  v_res jsonb;
begin
  if v_uid is null then return '[]'::jsonb; end if;
  v_orders := v_admin or has_permission('orders.manage');
  v_returns := v_admin or has_permission('returns.manage');
  v_settle := v_admin or has_permission('returns.settle');
  v_cust := v_admin or has_permission('customers.manage');
  v_loy := v_admin or has_permission('loyalty.manage');

  with items(audience, kind, ref, customer, title_ar, title_en, action_ar, action_en, route, since) as (
    -- ===================== CUSTOMER (ownership: created_by_id = caller) =====================
    select 'customer', 'return', r.request_code, null,
      'مطلوب معلومات إضافية لطلبك', 'Additional information requested',
      'تقديم المعلومات', 'Provide information', '/returns/' || r.id, r.updated_date
    from return_requests r where r.created_by_id = v_uid and r.status = 'needs_information'
    union all
    select 'customer', 'return', r.request_code, null,
      'أعد المنتج حسب التعليمات', 'Return the item as instructed',
      'عرض التعليمات', 'View instructions', '/returns/' || r.id, r.updated_date
    from return_requests r where r.created_by_id = v_uid and r.status = 'awaiting_return'
    union all
    select 'customer', 'return', r.request_code, null,
      'اختر طريقة الاسترداد', 'Choose your refund method',
      'اختيار الطريقة', 'Choose method', '/returns/' || r.id, r.updated_date
    from return_requests r where r.created_by_id = v_uid and r.status = 'processing' and r.request_type = 'return'
      and r.refund_method is null and not exists (select 1 from return_settlements s where s.return_request_id = r.id)
    union all
    select 'customer', 'return', r.request_code, null,
      'اختر المنتج البديل', 'Choose your replacement product',
      'اختيار البديل', 'Choose replacement', '/returns/' || r.id, r.updated_date
    from return_requests r where r.created_by_id = v_uid and r.status = 'processing' and r.request_type = 'exchange'
      and not exists (select 1 from return_settlements s where s.return_request_id = r.id)
      and exists (select 1 from return_request_items i where i.return_request_id = r.id and i.replacement_reserved_at is null)
    union all
    select 'customer', 'return', s.request_code, null,
      'ادفع فرق سعر الاستبدال', 'Pay the exchange price difference',
      'الدفع', 'Pay', '/returns/' || s.return_request_id, s.calculated_at
    from return_settlements s where s.created_by_id = v_uid and s.status = 'confirmed' and s.exchange_difference_status = 'due'

    -- ===================== ADMIN / EMPLOYEE =====================
    union all
    select 'admin', 'order', upper(right(o.id::text, 8)), o.customer_name,
      'طلب جديد بانتظار المعالجة', 'New order awaiting processing',
      'معالجة الطلب', 'Process order', '/orders-admin/' || o.id, o.created_date
    from orders o where v_orders and o.status in ('new', 'pending')
    union all
    select 'admin', 'order', upper(right(o.id::text, 8)), o.customer_name,
      case o.status when 'on_hold' then 'طلب معلّق بانتظار قرار' else 'فشل التوصيل - بانتظار قرار' end,
      case o.status when 'on_hold' then 'Order on hold - needs a decision' else 'Delivery failed - needs a decision' end,
      'فتح الطلب', 'Open order', '/orders-admin/' || o.id, o.updated_date
    from orders o where v_orders and o.status in ('on_hold', 'failed_delivery')
    union all
    select 'admin', 'order', upper(right(o.id::text, 8)), o.customer_name,
      'الطلب متوقف عند هذه المرحلة منذ فترة', 'Order stuck at this step',
      'المتابعة', 'Follow up', '/orders-admin/' || o.id, o.updated_date
    from orders o where v_orders and o.status in ('confirmed', 'preparing', 'ready', 'out_for_delivery')
      and o.updated_date < now() - interval '24 hours'
    union all
    select 'admin', 'return', r.request_code, (select customer_name from orders where id = r.order_id),
      case r.status when 'submitted' then 'طلب ' || case r.request_type when 'exchange' then 'استبدال' else 'إرجاع' end || ' جديد'
        else 'طلب الإرجاع/الاستبدال بحاجة لقرار' end,
      case r.status when 'submitted' then 'New ' || r.request_type || ' request' else 'Request needs a decision' end,
      'مراجعة الطلب', 'Review request', '/admin/return-requests/' || r.id, r.updated_date
    from return_requests r where v_returns and r.status in ('submitted', 'under_review')
    union all
    select 'admin', 'return', r.request_code, (select customer_name from orders where id = r.order_id),
      'المنتج المرتجع بانتظار الفحص', 'Returned item waiting for inspection',
      'إجراء الفحص', 'Inspect item', '/admin/return-requests/' || r.id, r.updated_date
    from return_requests r where v_returns and r.status = 'received'
    union all
    select 'admin', 'return', r.request_code, (select customer_name from orders where id = r.order_id),
      'منتج تالف/ناقص بانتظار قرار التصرف', 'Damaged/incomplete item awaiting disposition',
      'مراجعة القرار', 'Review disposition', '/admin/return-requests/' || r.id, r.updated_date
    from return_requests r where v_returns and r.needs_admin_disposition_review and r.status not in ('completed', 'cancelled', 'rejected')
    union all
    select 'admin', 'return', r.request_code, (select customer_name from orders where id = r.order_id),
      'حدّد حلّ القطعة الناقصة', 'Set the resolution for the missing item',
      'تحديد الحل', 'Set resolution', '/admin/return-requests/' || r.id, r.updated_date
    from return_requests r where v_returns and r.status = 'approved'
      and exists (select 1 from return_request_items i where i.return_request_id = r.id and i.missing_resolution is null)
    union all
    select 'admin', 'return', s.request_code, (select customer_name from orders where id = s.order_id),
      'تسوية مالية بانتظار التأكيد', 'Settlement awaiting confirmation',
      'تأكيد التسوية', 'Confirm settlement', '/admin/return-requests/' || s.return_request_id, s.calculated_at
    from return_settlements s where v_settle and s.status = 'calculated'
    union all
    select 'admin', 'return', s.request_code, (select customer_name from orders where id = s.order_id),
      'بانتظار تأكيد استلام فرق الاستبدال نقدًا', 'Awaiting confirmation of cash difference collected',
      'تأكيد الاستلام', 'Confirm cash', '/admin/return-requests/' || s.return_request_id, s.calculated_at
    from return_settlements s where v_settle and s.status = 'confirmed' and s.exchange_difference_status = 'cod_pending'
    union all
    select 'admin', 'refund', f.refund_code, (select customer_name from orders where id = f.order_id),
      case f.status when 'failed' then 'فشل الاسترداد - يحتاج إعادة محاولة' else 'استرداد نقدي بانتظار المعالجة' end,
      case f.status when 'failed' then 'Refund failed - needs retry' else 'Cash refund awaiting processing' end,
      'فتح الاسترداد', 'Open refund', '/admin/return-requests/' || f.return_request_id, f.created_date
    from return_refunds f where v_settle and f.status in ('pending', 'processing', 'failed')
    union all
    select 'admin', 'rewards', upper(right(o.id::text, 8)), o.customer_name,
      'مكافآت الطلب بحاجة لمراجعة المسؤول', 'Order rewards need admin review',
      'فتح الطلب', 'Open order', '/orders-admin/' || o.id, o.updated_date
    from orders o where v_loy and o.rewards_review_needed
    union all
    select 'admin', 'inquiry', 'Q-' || upper(right(q.id::text, 6)), q.customer_name,
      'استفسار زبون بانتظار الرد', 'Customer inquiry awaiting response',
      'الرد', 'Respond', '/admin/inquiries', q.created_date
    from customer_inquiries q where v_cust and q.status = 'new'
    union all
    select 'admin', 'review', 'REV-' || upper(right(rv.id::text, 6)), rv.name,
      'صورة مراجعة بانتظار الموافقة', 'Photo review awaiting approval',
      'مراجعة الصورة', 'Review photo', '/admin/photo-reviews', rv.created_date
    from reviews rv where v_admin and rv.status = 'pending'
    union all
    select 'admin', 'challenge', 'CH-' || upper(right(c.id::text, 6)), null,
      'إثبات تحدٍّ بانتظار الموافقة', 'Challenge submission awaiting approval',
      'مراجعة الإثبات', 'Review submission', '/admin/challenges', c.created_date
    from challenge_submissions c where v_admin and c.status = 'pending'
    union all
    select 'admin', 'reward', 'WHL-' || upper(right(w.id::text, 6)), w.customer_name,
      'مكافأة عجلة غير متاحة تحتاج معالجة يدوية', 'Unavailable wheel reward needs manual handling',
      'فتح المكافأة', 'Open reward', '/admin/wheel-winners', w.created_date
    from wheel_spins w where v_admin and w.status = 'unavailable'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'audience', audience, 'kind', kind, 'ref', ref, 'customer', customer,
      'title_ar', title_ar, 'title_en', title_en, 'action_ar', action_ar, 'action_en', action_en,
      'route', route, 'since', since,
      'priority', case when since < now() - interval '24 hours' then 'urgent' else 'normal' end
    ) order by since asc), '[]'::jsonb)
  into v_res from items;
  return v_res;
end;
$$;
revoke execute on function public.action_required_items() from public, anon;
grant execute on function public.action_required_items() to authenticated;
