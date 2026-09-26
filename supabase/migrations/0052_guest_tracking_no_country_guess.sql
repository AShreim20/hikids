-- Guest order tracking hardening: never guess a country.
--
-- 0051 treated a phone with no +970/+972 prefix as +970. Every real checkout
-- order already stores '<dial> <local>' (see Checkout.jsx: dialFor(country)), and
-- no stored order lacks a prefix, so the assumption is not needed and is removed:
-- a number whose country cannot be read from the number itself now normalizes to
-- NULL and never matches anything.
--
-- Still supported: the duplicated-prefix historical format ('+970 +970 59...'),
-- a leading 00, and leading zeros of the local part ('059...' == '59...').

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
  if cc is null then return null; end if;
  return cc || ltrim(d, '0');
end;
$$;

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
  if v_phone is null or length(v_phone) < 11 or length(v_phone) > 15 then return null; end if;

  -- The order number is only a filter: several orders may share the same last
  -- characters, and a row is returned ONLY when its own phone also matches.
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
