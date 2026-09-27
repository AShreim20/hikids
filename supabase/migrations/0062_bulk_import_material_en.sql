-- bulk_import_products (0030) has an explicit per-column allowlist —
-- material_en (added by 0061) wasn't in it yet, so an Excel re-import of the
-- new "Material (English)" column would have silently done nothing even
-- though the client now sends it. Re-creates the function with one added
-- line, identical pattern to every other optional text column here.
create or replace function public.bulk_import_products(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_fields jsonb;
  v_code text;
  v_product public.products;
  v_results jsonb := '[]'::jsonb;
  v_new_barcode text;
  v_new_stock int;
  v_delta int;
  v_new_unit_cost numeric;
  v_cat_id uuid;
  v_cat_ids uuid[];
  v_bad_cat_id uuid;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    v_code := btrim(coalesce(v_item->>'product_code', ''));
    v_fields := coalesce(v_item->'fields', '{}'::jsonb);
    begin
      if v_code = '' then
        raise exception 'Missing Product Code';
      end if;

      select * into v_product from public.products where lower(product_code) = lower(v_code) for update;
      if not found then
        raise exception 'Product Code not found: %', v_code;
      end if;

      if v_fields ? 'barcode' then
        v_new_barcode := nullif(btrim(v_fields->>'barcode'), '');
        if v_new_barcode is not null and v_new_barcode is distinct from v_product.barcode
           and exists (select 1 from public.products where barcode = v_new_barcode and id <> v_product.id) then
          raise exception 'Barcode already in use by another product';
        end if;
      end if;

      if v_fields ? 'primary_category_id' and (v_fields->>'primary_category_id') is not null then
        v_cat_id := (v_fields->>'primary_category_id')::uuid;
        if not exists (select 1 from public.categories where id = v_cat_id) then
          raise exception 'Unknown category';
        end if;
      end if;
      if v_fields ? 'category_ids' then
        select array_agg((x)::uuid) into v_cat_ids from jsonb_array_elements_text(coalesce(v_fields->'category_ids', '[]'::jsonb)) x;
        if v_cat_ids is not null then
          select c into v_bad_cat_id from unnest(v_cat_ids) c
            where not exists (select 1 from public.categories where id = c) limit 1;
          if v_bad_cat_id is not null then
            raise exception 'Unknown additional category';
          end if;
        end if;
      end if;

      if v_fields ? 'stock' then
        v_new_stock := (v_fields->>'stock')::int;
        if v_new_stock < 0 then
          raise exception 'Stock cannot be negative';
        end if;
        v_delta := v_new_stock - coalesce(v_product.stock, 0);
        v_new_unit_cost := case when v_fields ? 'unit_cost' then (v_fields->>'unit_cost')::numeric else null end;
        if v_delta <> 0 or v_new_unit_cost is not null then
          perform public.adjust_product_stock(v_product.id, v_delta, v_new_unit_cost);
        end if;
      elsif v_fields ? 'unit_cost' then
        perform public.adjust_product_stock(v_product.id, 0, (v_fields->>'unit_cost')::numeric);
      end if;

      update public.products set
        name = case when v_fields ? 'name' then v_fields->>'name' else name end,
        name_en = case when v_fields ? 'name_en' then nullif(v_fields->>'name_en', '') else name_en end,
        description = case when v_fields ? 'description' then v_fields->>'description' else description end,
        description_en = case when v_fields ? 'description_en' then nullif(v_fields->>'description_en', '') else description_en end,
        price = case when v_fields ? 'price' then (v_fields->>'price')::numeric else price end,
        sale_price = case when v_fields ? 'sale_price' then nullif(v_fields->>'sale_price', '')::numeric else sale_price end,
        barcode = case when v_fields ? 'barcode' then v_new_barcode else barcode end,
        material = case when v_fields ? 'material' then nullif(v_fields->>'material', '') else material end,
        material_en = case when v_fields ? 'material_en' then nullif(v_fields->>'material_en', '') else material_en end,
        tags = case when v_fields ? 'tags' then
          (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text(coalesce(v_fields->'tags', '[]'::jsonb)) x)
          else tags end,
        features_ar = case when v_fields ? 'features_ar' then
          (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text(coalesce(v_fields->'features_ar', '[]'::jsonb)) x)
          else features_ar end,
        features_en = case when v_fields ? 'features_en' then
          (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text(coalesce(v_fields->'features_en', '[]'::jsonb)) x)
          else features_en end,
        gender = case when v_fields ? 'gender' then nullif(v_fields->>'gender', '') else gender end,
        status = case when v_fields ? 'status' then v_fields->>'status' else status end,
        featured = case when v_fields ? 'featured' then (v_fields->>'featured')::boolean else featured end,
        loyalty_exempt = case when v_fields ? 'loyalty_exempt' then (v_fields->>'loyalty_exempt')::boolean else loyalty_exempt end,
        primary_category_id = case when v_fields ? 'primary_category_id' then v_cat_id else primary_category_id end,
        category = case when v_fields ? 'category' then v_fields->>'category' else category end,
        category_ids = case when v_fields ? 'category_ids' then coalesce(v_cat_ids, '{}'::uuid[]) else category_ids end,
        updated_date = now()
      where id = v_product.id;

      v_results := v_results || jsonb_build_array(jsonb_build_object('product_code', v_code, 'success', true));
    exception when others then
      v_results := v_results || jsonb_build_array(jsonb_build_object('product_code', v_code, 'success', false, 'error', sqlerrm));
    end;
  end loop;

  return jsonb_build_object('success', true, 'results', v_results);
end;
$$;

revoke execute on function public.bulk_import_products(jsonb) from public;
grant execute on function public.bulk_import_products(jsonb) to authenticated;
