-- Optional win limits for wheel rewards.
--
-- Costly rewards (a free toy, free delivery...) were controlled only by their
-- probability. An admin can now also cap them:
--   max_total_wins  - the reward can be won at most this many times, ever
--   max_daily_wins  - ... and at most this many times per day (Palestine day)
-- NULL = unlimited. The wheel still shows every active segment; a reward that
-- has hit a limit is simply skipped by the server draw, and the remaining
-- rewards are drawn in proportion to their appearance probabilities.
--
-- Rules enforced here, in the database:
--   * wheel_spin() never picks a reward that reached a limit;
--   * if no reward can be won right now the spin is refused BEFORE a spin is
--     consumed (the customer keeps it);
--   * save_wheel_rewards() requires at least one active, unlimited reward so
--     there is always something the wheel can give;
--   * the draw is serialised with an advisory lock so two customers can't both
--     win the last unit of a limited reward.

alter table public.wheel_rewards
  add column if not exists max_total_wins integer,
  add column if not exists max_daily_wins integer;

alter table public.wheel_rewards drop constraint if exists wheel_rewards_caps_positive;
alter table public.wheel_rewards
  add constraint wheel_rewards_caps_positive
  check ((max_total_wins is null or max_total_wins > 0) and (max_daily_wins is null or max_daily_wins > 0));

-- Start of "today" in Palestine.
create or replace function public._wheel_day_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('day', now() at time zone 'Asia/Hebron') at time zone 'Asia/Hebron';
$$;
revoke execute on function public._wheel_day_start() from public, anon, authenticated;

-- Admin-only: how often each reward was won (total and today).
create or replace function public.wheel_reward_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;
  return jsonb_build_object('success', true, 'usage', coalesce((
    select jsonb_agg(jsonb_build_object(
      'reward_id', r.id,
      'total', (select count(*) from public.wheel_spins s where s.reward_id = r.id),
      'today', (select count(*) from public.wheel_spins s where s.reward_id = r.id and s.created_date >= public._wheel_day_start())
    )) from public.wheel_rewards r
  ), '[]'::jsonb));
end;
$$;
revoke execute on function public.wheel_reward_usage() from public, anon;
grant execute on function public.wheel_reward_usage() to authenticated;

-- save_wheel_rewards: as 0063, plus the two limits and the "at least one
-- unlimited active reward" rule.
create or replace function public.save_wheel_rewards(p_rewards jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_count int := 0;
  v_unlimited int := 0;
  v_sum numeric := 0;
  v_p numeric;
  v_active boolean;
  v_label text;
  v_type text;
  v_product_id uuid;
  v_max_total int;
  v_max_daily int;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;
  if p_rewards is null or jsonb_typeof(p_rewards) <> 'array' then
    return jsonb_build_object('success', false, 'message', 'Invalid payload');
  end if;

  for v_item in select * from jsonb_array_elements(p_rewards) loop
    v_label := btrim(coalesce(v_item->>'label', ''));
    v_type := coalesce(v_item->>'type', '');
    v_active := coalesce((v_item->>'active')::boolean, true);
    begin
      v_p := round(coalesce(nullif(v_item->>'probability_percent', ''), '0')::numeric, 4);
      v_max_total := nullif(v_item->>'max_total_wins', '')::int;
      v_max_daily := nullif(v_item->>'max_daily_wins', '')::int;
    exception when others then
      return jsonb_build_object('success', false, 'message', 'Invalid probability or limit');
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
    if (v_max_total is not null and v_max_total <= 0) or (v_max_daily is not null and v_max_daily <= 0) then
      return jsonb_build_object('success', false, 'message', 'Win limits must be positive whole numbers (or empty for no limit)');
    end if;
    if v_active then
      if v_p <= 0 then
        return jsonb_build_object('success', false, 'message', 'Every active reward needs a probability above 0 (or mark it inactive)');
      end if;
      v_count := v_count + 1;
      v_sum := v_sum + v_p;
      if v_max_total is null and v_max_daily is null then
        v_unlimited := v_unlimited + 1;
      end if;
    end if;
  end loop;

  if v_count > 0 and abs(v_sum - 100) > 0.001 then
    return jsonb_build_object('success', false, 'message', 'Active reward probabilities must total 100%', 'total', v_sum);
  end if;
  if v_count > 0 and v_unlimited = 0 then
    return jsonb_build_object('success', false, 'message', 'At least one active reward must have no win limit');
  end if;

  for v_item in select * from jsonb_array_elements(p_rewards) loop
    v_id := nullif(v_item->>'id', '')::uuid;
    v_p := round(coalesce(nullif(v_item->>'probability_percent', ''), '0')::numeric, 4);
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_max_total := nullif(v_item->>'max_total_wins', '')::int;
    v_max_daily := nullif(v_item->>'max_daily_wins', '')::int;
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
        max_total_wins = v_max_total,
        max_daily_wins = v_max_daily,
        active = coalesce((v_item->>'active')::boolean, true),
        sort_order = coalesce(nullif(v_item->>'sort_order', '')::int, sort_order)
      where id = v_id;
    else
      insert into public.wheel_rewards (label, label_en, type, value, product_id, product_name, probability_percent, weight, max_total_wins, max_daily_wins, active, sort_order)
      values (
        btrim(v_item->>'label'),
        nullif(btrim(coalesce(v_item->>'label_en', '')), ''),
        v_item->>'type',
        coalesce(nullif(v_item->>'value', '')::numeric, 0),
        v_product_id,
        nullif(v_item->>'product_name', ''),
        v_p, v_p, v_max_total, v_max_daily,
        coalesce((v_item->>'active')::boolean, true),
        coalesce(nullif(v_item->>'sort_order', '')::int, 0)
      ) returning id into v_id;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  delete from public.wheel_rewards where id <> all(v_ids);

  return jsonb_build_object('success', true, 'total', v_sum, 'active_count', v_count);
end;
$function$;

-- Same rule enforced on the table itself (deferred, so a whole set can be
-- replaced in one transaction): whenever any reward is active, at least one
-- active reward must have no win limit.
create or replace function public.check_wheel_has_unlimited_reward()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_active int;
  v_unlimited int;
begin
  select count(*) filter (where active), count(*) filter (where active and max_total_wins is null and max_daily_wins is null)
    into v_active, v_unlimited from public.wheel_rewards;
  if v_active > 0 and v_unlimited = 0 then
    raise exception 'At least one active wheel reward must have no win limit';
  end if;
  return null;
end;
$$;

drop trigger if exists wheel_rewards_need_unlimited on public.wheel_rewards;
create constraint trigger wheel_rewards_need_unlimited
  after insert or update or delete on public.wheel_rewards
  deferrable initially deferred
  for each row execute function public.check_wheel_has_unlimited_reward();

-- wheel_spin: identical to 0063 except the draw skips rewards that reached a
-- limit (under an advisory lock) and says so if nothing can be won.
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
  v_day_start timestamptz := public._wheel_day_start();
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

  -- One draw at a time, so a limited reward's last unit can't be won twice.
  perform pg_advisory_xact_lock(hashtext('wheel_spin_reward_caps'));

  select * into v_picked from public.wheel_rewards r
  where r.active = true and coalesce(r.probability_percent, 0) > 0
    and (r.max_total_wins is null
         or (select count(*) from public.wheel_spins s where s.reward_id = r.id) < r.max_total_wins)
    and (r.max_daily_wins is null
         or (select count(*) from public.wheel_spins s where s.reward_id = r.id and s.created_date >= v_day_start) < r.max_daily_wins)
  order by ln(1 - random()) / r.probability_percent::float8 desc
  limit 1;
  if v_picked.id is null then
    return jsonb_build_object('success', false, 'message', 'No rewards available right now');
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
