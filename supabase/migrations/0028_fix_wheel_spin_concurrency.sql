-- CRITICAL security fix (pre-launch audit): Mystery Wheel spin consumption
-- had a check-then-act race condition.
--
-- Root cause: compute_wheel_state() derives "available spins" from an
-- unlocked `select count(*) from wheel_spins where user_email = ...`,
-- computed BEFORE wheel_spin() inserts its own new spin row. Two
-- concurrent calls for the same user (two tabs, or two direct
-- supabase.rpc('wheel_spin') calls — nothing throttles this) could both
-- read the same "available > 0" before either had recorded a spin, so both
-- could proceed to grant a reward from a single earned spin. The
-- points-reward idempotency key was also a microsecond timestamp
-- ('wheel-' || uid || '-' || extract(epoch from clock_timestamp())), which
-- is different on every call and so provides no accidental protection
-- against this race either.
--
-- A related, already-live consequence of the same missing-lock class of bug
-- was found and fixed here too: get_or_create_wheel_progress() was a plain
-- check-then-insert with no unique constraint backing it, and a real
-- customer's data already shows two duplicate wheel_progress rows created
-- five microseconds apart (both all-zero state, safe to deduplicate) —
-- direct evidence this exact class of race has already fired in
-- production, not just a theoretical concern.
--
-- Fix: (1) deduplicate any existing duplicate wheel_progress rows and add a
-- unique constraint on user_email so there is exactly one physical row per
-- user to lock; (2) make get_or_create_wheel_progress race-safe via
-- INSERT ... ON CONFLICT DO NOTHING; (3) have wheel_spin() lock that one
-- row (`for update`) before computing eligibility, using the same
-- row-locking pattern already proven correct for loyalty redemption
-- (post_ledger's `for update` on the wallet row) — a second concurrent
-- call blocks on the lock until the first commits, then re-reads the spin
-- count with the first spin already counted, and correctly sees
-- available = 0.

-- Step 1: deduplicate existing wheel_progress rows before the unique
-- constraint can be added. Keep the most "advanced" row per user (most
-- spins used, then most spins earned, then a granted free spin, then the
-- earliest row as a final tiebreaker) and drop the rest — safe because no
-- other table references wheel_progress.id (wheel_spins/reward_history key
-- off user_email, not this table's id).
with ranked as (
  select id, user_email,
         row_number() over (
           partition by user_email
           order by spins_used desc, spins_earned desc, free_spin_granted desc, created_date asc, id asc
         ) as rn
  from public.wheel_progress
)
delete from public.wheel_progress wp
using ranked
where wp.id = ranked.id
  and ranked.rn > 1;

alter table public.wheel_progress
  add constraint wheel_progress_user_email_key unique (user_email);

create or replace function public.get_or_create_wheel_progress(p_user_id uuid, p_user_email text)
returns wheel_progress
language plpgsql
security definer
set search_path = public
as $$
declare v_progress public.wheel_progress;
begin
  insert into public.wheel_progress (user_id, user_email, eligible_amount, spins_earned, spins_used, free_spin_granted)
  values (p_user_id, p_user_email, 0, 0, 0, false)
  on conflict (user_email) do nothing;

  select * into v_progress from public.wheel_progress where user_email = p_user_email limit 1;
  return v_progress;
end;
$$;

create or replace function public.wheel_spin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- Ensure the per-user progress row exists, then lock it for the rest of
  -- this transaction so two concurrent spin attempts for the same user can
  -- never both observe "a spin is available" before either has recorded
  -- its own spin — see migration header.
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

  -- Weighted random pick (Efraimidis-Spirakis: P(pick) proportional to weight).
  select * into v_picked from public.wheel_rewards
  where active = true and coalesce(weight, 0) > 0
  order by power(random(), 1.0 / weight) desc
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
      'id', v_spin_id, 'label', v_picked.label, 'label_en', coalesce(v_picked.label_en, ''),
      'type', v_picked.type, 'value', v_picked.value,
      'points', v_points, 'discount_code', v_discount_code, 'fulfillment', v_fulfillment,
      'status', v_status, 'expires_at', v_expires_at,
      'product', case when v_product_id is not null then jsonb_build_object('id', v_product_id, 'name', v_product_name, 'name_en', v_product_name_en, 'image_url', v_product_image, 'price', v_product_price) else null end
    )
  );
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
