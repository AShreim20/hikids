-- Prize wheel: explicit appearance probability (%) instead of a technical
-- "weight", plus server-side validation that active rewards total exactly 100%.
--
-- Selection was already weight-proportional (Efraimidis–Spirakis key
-- power(random(), 1/weight), highest key wins => P(i) = w_i / sum(w)). So
-- converting weight -> weight/sum(weight)*100 keeps every reward's effective
-- odds IDENTICAL; nothing about who wins changes, only how it is configured.
--
-- `weight` is left in place (legacy, no longer read by the spin); the new
-- save RPC keeps it mirrored to the percentage so anything still reading it
-- sees a coherent number.

alter table public.wheel_rewards
  add column if not exists probability_percent numeric(7,4) not null default 0;

alter table public.wheel_rewards
  drop constraint if exists wheel_rewards_probability_range;
alter table public.wheel_rewards
  add constraint wheel_rewards_probability_range
  check (probability_percent >= 0 and probability_percent <= 100);

-- Backfill: only when nothing has been converted yet (idempotent). Active
-- rewards with weight > 0 get weight/total*100 (4 dp); any rounding residue
-- goes to the largest reward so the active total is exactly 100.0000.
do $$
declare
  v_total numeric;
  v_sum numeric;
  v_max uuid;
begin
  select coalesce(sum(weight), 0) into v_total
    from public.wheel_rewards where active and coalesce(weight, 0) > 0;
  if v_total > 0
     and coalesce((select sum(probability_percent) from public.wheel_rewards where active), 0) = 0 then
    update public.wheel_rewards
       set probability_percent = round(weight / v_total * 100, 4)
     where active and coalesce(weight, 0) > 0;
    select coalesce(sum(probability_percent), 0) into v_sum from public.wheel_rewards where active;
    select id into v_max from public.wheel_rewards
      where active and coalesce(weight, 0) > 0
      order by weight desc, created_date, id limit 1;
    if v_max is not null and v_sum <> 100 then
      update public.wheel_rewards set probability_percent = probability_percent + (100 - v_sum) where id = v_max;
    end if;
  end if;
end $$;

-- Invariant, enforced at COMMIT so several rows can be changed together in
-- one transaction (see save_wheel_rewards): if any reward is active, the
-- active rewards' probabilities must total 100 (±0.001 for decimal safety).
create or replace function public.check_wheel_probability_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count int;
  v_sum numeric;
begin
  select count(*), coalesce(sum(probability_percent), 0) into v_count, v_sum
    from public.wheel_rewards where active;
  if v_count > 0 and abs(v_sum - 100) > 0.001 then
    raise exception 'Active wheel reward probabilities must total 100%% (currently %)', v_sum
      using errcode = '23514';
  end if;
  return null;
end;
$$;

drop trigger if exists wheel_rewards_probability_total on public.wheel_rewards;
create constraint trigger wheel_rewards_probability_total
  after insert or update or delete on public.wheel_rewards
  deferrable initially deferred
  for each row execute function public.check_wheel_probability_total();

-- Activating the wheel itself requires a valid 100% reward set. Only the
-- inactive -> active transition is checked, so editing other config fields
-- on an already-active wheel is never blocked.
create or replace function public.check_wheel_config_activation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count int;
  v_sum numeric;
begin
  if new.active and (tg_op = 'INSERT' or old.active is distinct from true) then
    select count(*), coalesce(sum(probability_percent), 0) into v_count, v_sum
      from public.wheel_rewards where active;
    if v_count = 0 or abs(v_sum - 100) > 0.001 then
      raise exception 'Cannot activate the wheel: active reward probabilities must total exactly 100%% (currently %)', v_sum
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists wheel_config_activation_check on public.wheel_config;
create trigger wheel_config_activation_check
  before insert or update on public.wheel_config
  for each row execute function public.check_wheel_config_activation();

revoke execute on function public.check_wheel_probability_total() from public, anon, authenticated;
revoke execute on function public.check_wheel_config_activation() from public, anon, authenticated;

-- Atomic admin save of the whole reward list. One transaction, so the
-- deferred 100% check sees the final state, not each intermediate row.
-- Rewards missing from the list are deleted (same effect as the old
-- per-row delete button).
create or replace function public.save_wheel_rewards(p_rewards jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_count int := 0;
  v_sum numeric := 0;
  v_p numeric;
  v_active boolean;
  v_label text;
  v_type text;
  v_product_id uuid;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;
  if p_rewards is null or jsonb_typeof(p_rewards) <> 'array' then
    return jsonb_build_object('success', false, 'message', 'Invalid payload');
  end if;

  -- Validate everything first; nothing is written unless all of it is valid.
  for v_item in select * from jsonb_array_elements(p_rewards) loop
    v_label := btrim(coalesce(v_item->>'label', ''));
    v_type := coalesce(v_item->>'type', '');
    v_active := coalesce((v_item->>'active')::boolean, true);
    begin
      v_p := round(coalesce(nullif(v_item->>'probability_percent', ''), '0')::numeric, 4);
    exception when others then
      return jsonb_build_object('success', false, 'message', 'Invalid probability');
    end;
    if v_label = '' then
      return jsonb_build_object('success', false, 'message', 'Every reward needs an Arabic label');
    end if;
    if v_type not in ('points', 'discount_percent', 'discount_fixed', 'free_delivery', 'product', 'credit') then
      return jsonb_build_object('success', false, 'message', 'Invalid reward type');
    end if;
    if v_p < 0 or v_p > 100 then
      return jsonb_build_object('success', false, 'message', 'Probability must be between 0 and 100');
    end if;
    if v_active then
      if v_p <= 0 then
        return jsonb_build_object('success', false, 'message', 'Every active reward needs a probability above 0 (or mark it inactive)');
      end if;
      v_count := v_count + 1;
      v_sum := v_sum + v_p;
    end if;
  end loop;

  if v_count > 0 and abs(v_sum - 100) > 0.001 then
    return jsonb_build_object('success', false, 'message', 'Active reward probabilities must total 100%', 'total', v_sum);
  end if;

  for v_item in select * from jsonb_array_elements(p_rewards) loop
    v_id := nullif(v_item->>'id', '')::uuid;
    v_p := round(coalesce(nullif(v_item->>'probability_percent', ''), '0')::numeric, 4);
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    if v_id is not null and exists (select 1 from public.wheel_rewards where id = v_id) then
      update public.wheel_rewards set
        label = btrim(v_item->>'label'),
        label_en = nullif(btrim(coalesce(v_item->>'label_en', '')), ''),
        type = v_item->>'type',
        value = coalesce(nullif(v_item->>'value', '')::numeric, 0),
        product_id = v_product_id,
        product_name = nullif(v_item->>'product_name', ''),
        probability_percent = v_p,
        weight = v_p,
        active = coalesce((v_item->>'active')::boolean, true),
        sort_order = coalesce(nullif(v_item->>'sort_order', '')::int, sort_order)
      where id = v_id;
    else
      insert into public.wheel_rewards (label, label_en, type, value, product_id, product_name, probability_percent, weight, active, sort_order)
      values (
        btrim(v_item->>'label'),
        nullif(btrim(coalesce(v_item->>'label_en', '')), ''),
        v_item->>'type',
        coalesce(nullif(v_item->>'value', '')::numeric, 0),
        v_product_id,
        nullif(v_item->>'product_name', ''),
        v_p, v_p,
        coalesce((v_item->>'active')::boolean, true),
        coalesce(nullif(v_item->>'sort_order', '')::int, 0)
      ) returning id into v_id;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  delete from public.wheel_rewards where id <> all(v_ids);

  return jsonb_build_object('success', true, 'total', v_sum, 'active_count', v_count);
end;
$$;

revoke execute on function public.save_wheel_rewards(jsonb) from public, anon;
grant execute on function public.save_wheel_rewards(jsonb) to authenticated;

-- wheel_state: return rewards in a stable order. The wheel is drawn in this
-- order and the spin animation lands on a segment index, so an unordered
-- jsonb_agg (which could reshuffle between two calls) could misalign the
-- picture after the post-spin refresh.
create or replace function public.wheel_state()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_state jsonb;
  v_rewards jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  v_state := public.compute_wheel_state(v_uid, v_email);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.created_date, r.id), '[]'::jsonb)
    into v_rewards from public.wheel_rewards r where active = true;
  return jsonb_build_object('success', true) || v_state || jsonb_build_object('rewards', v_rewards);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$function$;

-- wheel_spin: identical to the live definition except
--   (1) the winner is drawn from probability_percent (same weighted-draw
--       algorithm, expressed in log space so very small percentages can't
--       underflow: argmax of ln(1-u)/p  ==  argmax of u^(1/p)), and
--   (2) the response also carries `reward_id` (the wheel_rewards row that
--       won) so the client lands on the exact segment instead of matching by
--       label text.
-- Entitlement, locking, fulfillment, points/discount/product/delivery
-- handling and reward history are untouched.
create or replace function public.wheel_spin()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_state jsonb;
  v_config jsonb;
  v_picked public.wheel_rewards;
  v_expires_at timestamptz;
  v_points int := 0;
  v_status text := 'unused';
  v_fulfillment text := 'auto';
  v_product_id uuid;
  v_product_name text := '';
  v_product_name_en text := '';
  v_product_image text := '';
  v_product_price numeric := 0;
  v_product public.products;
  v_customer_name text := '';
  v_customer_phone text := '';
  v_latest_order public.orders;
  v_spin_id uuid;
  v_discount_code text := '';
  v_dc public.discount_codes;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  perform public.get_or_create_wheel_progress(v_uid, v_email);
  perform 1 from public.wheel_progress where user_email = v_email for update;

  v_state := public.compute_wheel_state(v_uid, v_email);
  if not coalesce((v_state->>'active')::boolean, false) then
    return jsonb_build_object('success', false, 'message', 'Wheel is not active');
  end if;
  if coalesce((v_state->>'available')::int, 0) <= 0 then
    return jsonb_build_object('success', false, 'message', 'No spins available');
  end if;
  v_config := v_state->'config';
  if coalesce((v_config->>'max_spins')::int, 0) > 0 and coalesce((v_state->>'used')::int, 0) >= (v_config->>'max_spins')::int then
    return jsonb_build_object('success', false, 'message', 'Maximum spins reached');
  end if;

  select * into v_picked from public.wheel_rewards
  where active = true and coalesce(probability_percent, 0) > 0
  order by ln(1 - random()) / probability_percent::float8 desc
  limit 1;
  if v_picked.id is null then
    return jsonb_build_object('success', false, 'message', 'No rewards configured');
  end if;

  v_expires_at := case when coalesce((v_config->>'reward_expiry_days')::int, 0) > 0
    then now() + (coalesce((v_config->>'reward_expiry_days')::int, 0) || ' days')::interval else null end;

  if v_picked.type = 'points' then
    v_points := trunc(coalesce(v_picked.value, 0))::int;
    perform public.grant_reward_points(v_uid, v_email, v_points, 'Mystery Wheel reward', 'wheel-' || v_uid::text || '-' || extract(epoch from clock_timestamp())::text);
    v_status := 'used';
  elsif v_picked.type = 'product' then
    v_product_id := v_picked.product_id;
    if v_product_id is not null then
      select * into v_product from public.products where id = v_product_id;
    end if;
    if v_product.id is not null and coalesce(v_product.stock, 0) > 0 then
      v_product_name := v_product.name;
      v_product_name_en := coalesce(v_product.name_en, '');
      v_product_image := coalesce(v_product.image_url, '');
      v_product_price := coalesce(v_product.sale_price, v_product.price, 0);
      v_status := 'unused';
      v_fulfillment := 'auto';
    else
      if v_product.id is not null then
        v_product_name := v_product.name;
        v_product_image := coalesce(v_product.image_url, '');
        v_product_price := coalesce(v_product.sale_price, v_product.price, 0);
      end if;
      v_status := 'unavailable';
      v_fulfillment := 'manual';
    end if;
  elsif v_picked.type = 'free_delivery' then
    v_status := 'unused';
    v_fulfillment := 'manual';
  else
    v_status := 'unused';
    v_fulfillment := 'auto';
  end if;

  select coalesce(full_name, ''), coalesce(phone, '') into v_customer_name, v_customer_phone from public.profiles where id = v_uid;
  if coalesce(v_customer_name, '') = '' or coalesce(v_customer_phone, '') = '' then
    select * into v_latest_order from public.orders where created_by_id = v_uid order by created_date desc limit 1;
    if v_latest_order.id is not null then
      if coalesce(v_customer_name, '') = '' then v_customer_name := coalesce(v_latest_order.customer_name, ''); end if;
      if coalesce(v_customer_phone, '') = '' then v_customer_phone := coalesce(v_latest_order.phone, ''); end if;
    end if;
  end if;

  insert into public.wheel_spins (
    user_id, user_email, source, reward_id, reward_type, reward_label, reward_label_en, reward_value,
    product_id, product_name, product_name_en, product_image, product_price,
    points_awarded, discount_code, discount_code_id, customer_name, customer_phone,
    status, redeemed_order_id, expires_at, fulfillment
  ) values (
    v_uid, v_email, 'purchase', v_picked.id, v_picked.type, v_picked.label, coalesce(v_picked.label_en, ''), coalesce(v_picked.value, 0),
    v_product_id, v_product_name, v_product_name_en, v_product_image, v_product_price,
    v_points, '', null, v_customer_name, v_customer_phone,
    v_status, null, v_expires_at, v_fulfillment
  ) returning id into v_spin_id;

  if v_picked.type in ('discount_percent', 'discount_fixed', 'credit') then
    v_dc := public.grant_discount_code_record(
      'WHL', case when v_picked.type = 'discount_percent' then 'percent' else 'fixed' end,
      v_picked.value, v_expires_at::date, v_email, v_spin_id, 'wheel', 'Mystery Wheel — ' || v_picked.label
    );
    v_discount_code := v_dc.code;
    update public.wheel_spins set discount_code = v_discount_code, discount_code_id = v_dc.id, updated_date = now() where id = v_spin_id;
  end if;

  update public.wheel_progress set
    spins_used = coalesce((v_state->'progress'->>'spins_used')::int, 0) + 1,
    last_activity_at = now(), updated_date = now()
  where id = (v_state->'progress'->>'id')::uuid;

  perform public.record_reward(
    v_uid, v_email, 'wheel', v_spin_id::text, coalesce(v_config->>'name', 'Mystery Wheel'), '',
    v_picked.type, v_picked.label, coalesce(v_picked.label_en, ''),
    v_points, v_discount_code, v_product_id,
    case when v_picked.type = 'credit' then coalesce(v_picked.value, 0) else 0 end, v_fulfillment
  );

  return jsonb_build_object(
    'success', true,
    'reward', jsonb_build_object(
      'id', v_spin_id, 'reward_id', v_picked.id, 'label', v_picked.label, 'label_en', coalesce(v_picked.label_en, ''),
      'type', v_picked.type, 'value', v_picked.value,
      'points', v_points, 'discount_code', v_discount_code, 'fulfillment', v_fulfillment,
      'status', v_status, 'expires_at', v_expires_at,
      'product', case when v_product_id is not null then jsonb_build_object('id', v_product_id, 'name', v_product_name, 'name_en', v_product_name_en, 'image_url', v_product_image, 'price', v_product_price) else null end
    )
  );
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$function$;
