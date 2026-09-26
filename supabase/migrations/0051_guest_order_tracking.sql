-- Guest order tracking.
--
-- A guest (no account) can look an order up by its public order number plus the
-- phone number used at checkout. The lookup runs ONLY through the trackOrder Edge
-- Function -> track_guest_order() below (SECURITY DEFINER, service_role only).
-- No RLS policy is added: anon still cannot SELECT from orders/order data.
--
-- Public order number = orderRef() in the app: 'ORD-' + last 6 hex chars of the
-- order id. Those 6 characters are NOT a secret, so the phone number is what
-- authenticates the request; the Edge Function additionally rate-limits per IP,
-- per order number and per phone.

-- Canonical phone form, mirroring Checkout: fullPhone = '<dial> <local digits>'
-- with dial in ('+970','+972'). Digits only; a leading 00 is dropped; repeated
-- country prefixes (legacy rows such as '+970 +970 59...') collapse to the first;
-- leading zeros of the local part are dropped ('059..' == '59...'); a number with
-- no country prefix is assumed to be Palestine (checkout's default country).
create or replace function public.normalize_order_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  cc text := null;
begin
  if d like '00%' then d := substr(d, 3); end if;
  while d ~ '^(970|972)' and length(d) > 9 loop
    if cc is null then cc := substr(d, 1, 3); end if;
    d := substr(d, 4);
  end loop;
  d := ltrim(d, '0');
  return coalesce(cc, '970') || d;
end;
$$;

-- Returns the customer-safe order JSON, or NULL when no order matches BOTH the
-- order number and the phone (the caller cannot tell which was wrong).
create or replace function public.track_guest_order(p_ref text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := upper(regexp_replace(coalesce(p_ref, ''), '^\s*ORD-?', '', 'i'));
  v_phone text := public.normalize_order_phone(p_phone);
  o record;
begin
  v_ref := regexp_replace(v_ref, '\s', '', 'g');
  if v_ref !~ '^[0-9A-F]{6,8}$' then return null; end if;
  if length(v_phone) < 11 or length(v_phone) > 15 then return null; end if;

  for o in
    select * from public.orders
    where upper(right(id::text, length(v_ref))) = v_ref
    order by created_date desc
    limit 20
  loop
    if public.normalize_order_phone(o.phone) = v_phone then
      return jsonb_build_object(
        'order_ref', 'ORD-' || upper(right(o.id::text, 6)),
        'created_date', o.created_date,
        'status', o.status,
        'payment_method', o.payment_method,
        'city', o.city,
        'subtotal', o.subtotal,
        'delivery_cost', o.delivery_cost,
        'discount_amount', o.discount_amount,
        'loyalty_discount', o.loyalty_discount,
        'total', o.total,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', i->>'name',
            'name_en', i->>'name_en',
            'qty', i->'qty',
            'price', i->'price',
            'variant_label', i->>'variant_label'
          ))
          from jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) i
        ), '[]'::jsonb)
      );
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.normalize_order_phone(text) from public, anon, authenticated;
revoke all on function public.track_guest_order(text, text) from public, anon, authenticated;
grant execute on function public.normalize_order_phone(text) to service_role;
grant execute on function public.track_guest_order(text, text) to service_role;
