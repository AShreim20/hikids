-- Atomic stock +/- delta and optional unit_cost set, used by
-- postPurchaseOrder (increment + set latest cost) and cancelPurchaseOrder
-- (decrement reversal, cost intentionally left untouched).
create or replace function public.adjust_product_stock(
  p_product_id uuid, p_delta int, p_unit_cost numeric default null
) returns public.products
language plpgsql
security definer set search_path = public
as $$
declare
  v_product public.products;
begin
  update public.products
  set stock = stock + p_delta,
      unit_cost = coalesce(p_unit_cost, unit_cost)
  where id = p_product_id
  returning * into v_product;
  return v_product;
end;
$$;

revoke execute on function public.adjust_product_stock(uuid, int, numeric) from public, anon, authenticated;
