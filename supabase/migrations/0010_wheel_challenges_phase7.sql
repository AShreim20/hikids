-- Phase 7: Wheel + Challenges. Ports the remaining 8 Base44 gamification
-- functions (wheelState, wheelSpin, wheelGrantFirstSpin, finalizeWheelRewards,
-- reverseWheelRewards, challengesClaim, challengesSubmitPhoto,
-- challengesReview) as Postgres RPC functions — same no-Edge-Function pattern
-- as Phases 5/6, built on the loyalty ledger core (post_ledger/
-- get_or_create_wallet) from Phase 3/6. All tables already existed from
-- Phase 0 with matching columns/RLS.

-- ── internal helpers (not directly callable by clients) ────────────────────

-- grantPoints() from base44/shared/rewards.ts.
create or replace function public.grant_reward_points(p_user_id uuid, p_user_email text, p_points int, p_reason text, p_idempotency_key text default null)
returns public.loyalty_accounts
language plpgsql
security definer set search_path = public
as $$
declare v_wallet public.loyalty_accounts;
begin
  v_wallet := public.get_or_create_wallet(p_user_id => p_user_id, p_user_email => p_user_email);
  perform public.post_ledger(
    p_wallet_id => v_wallet.id, p_points => coalesce(p_points, 0), p_type => 'ADMIN_CREDIT',
    p_reason => coalesce(p_reason, 'Gamification reward'), p_actor_email => 'rewards',
    p_idempotency_key => nullif(p_idempotency_key, '')
  );
  select * into v_wallet from public.loyalty_accounts where id = v_wallet.id;
  return v_wallet;
end;
$$;
revoke execute on function public.grant_reward_points(uuid, text, int, text, text) from public, anon, authenticated;

-- grantDiscountCodeRecord() from base44/shared/rewards.ts.
create or replace function public.grant_discount_code_record(
  p_prefix text, p_type text, p_value numeric, p_expires_at date, p_owner_email text, p_wheel_spin_id uuid, p_source text, p_description text
) returns public.discount_codes
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
  v_rec public.discount_codes;
begin
  v_code := coalesce(p_prefix, 'RW') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.discount_codes (code, type, value, usage_limit, used_count, active, expires_at, owner_email, wheel_spin_id, source, description)
  values (v_code, case when p_type = 'percent' then 'percent' else 'fixed' end, coalesce(p_value, 0), 1, 0, true, p_expires_at, coalesce(p_owner_email, ''), p_wheel_spin_id, coalesce(p_source, 'admin'), coalesce(p_description, ''))
  returning * into v_rec;
  return v_rec;
end;
$$;
revoke execute on function public.grant_discount_code_record(text, text, numeric, date, text, uuid, text, text) from public, anon, authenticated;

-- recordReward() from base44/shared/rewards.ts.
create or replace function public.record_reward(
  p_user_id uuid, p_user_email text, p_source text, p_source_id text, p_source_name text, p_source_name_en text,
  p_reward_type text, p_reward_label text, p_reward_label_en text, p_points int, p_discount_code text,
  p_product_id uuid, p_amount numeric, p_fulfillment text
) returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.reward_history (
    user_id, user_email, source, source_id, source_name, source_name_en,
    reward_type, reward_label, reward_label_en, points, discount_code, product_id, amount, fulfillment
  ) values (
    p_user_id, p_user_email, p_source, p_source_id, coalesce(p_source_name, ''), coalesce(p_source_name_en, ''),
    p_reward_type, coalesce(p_reward_label, ''), coalesce(p_reward_label_en, ''), coalesce(p_points, 0),
    coalesce(p_discount_code, ''), p_product_id, coalesce(p_amount, 0), coalesce(p_fulfillment, 'auto')
  );
end;
$$;
revoke execute on function public.record_reward(uuid, text, text, text, text, text, text, text, text, int, text, uuid, numeric, text) from public, anon, authenticated;

create or replace function public.get_or_create_wheel_progress(p_user_id uuid, p_user_email text)
returns public.wheel_progress
language plpgsql
security definer set search_path = public
as $$
declare v_progress public.wheel_progress;
begin
  select * into v_progress from public.wheel_progress where user_email = p_user_email limit 1;
  if v_progress.id is not null then return v_progress; end if;
  insert into public.wheel_progress (user_id, user_email, eligible_amount, spins_earned, spins_used, free_spin_granted)
  values (p_user_id, p_user_email, 0, 0, 0, false)
  returning * into v_progress;
  return v_progress;
end;
$$;
revoke execute on function public.get_or_create_wheel_progress(uuid, text) from public, anon, authenticated;

create or replace function public.get_or_create_challenge_progress(p_challenge_id uuid, p_user_id uuid, p_user_email text)
returns public.challenge_progress
language plpgsql
security definer set search_path = public
as $$
declare v_progress public.challenge_progress;
begin
  select * into v_progress from public.challenge_progress where challenge_id = p_challenge_id and user_email = p_user_email limit 1;
  if v_progress.id is not null then return v_progress; end if;
  insert into public.challenge_progress (challenge_id, user_id, user_email, completions, rewarded_count, recipients, rewarded_order_ids)
  values (p_challenge_id, p_user_id, p_user_email, 0, 0, '{}', '{}')
  returning * into v_progress;
  return v_progress;
end;
$$;
revoke execute on function public.get_or_create_challenge_progress(uuid, uuid, text) from public, anon, authenticated;

-- computeWheelState() from base44/shared/rewards.ts. Date comparisons against
-- start_date/end_date deliberately compare full timestamps against midnight
-- of those dates (not ::date-truncated "now"), matching the original JS
-- `now < new Date(config.start_date)` semantics exactly — including the
-- gotcha that a purchase on the end_date's calendar day already reads as
-- expired, since midnight is the boundary.
create or replace function public.compute_wheel_state(p_user_id uuid, p_user_email text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_config public.wheel_config;
  v_now timestamptz := now();
  v_min numeric;
  v_eligible numeric := 0;
  v_earned int := 0;
  v_progress public.wheel_progress;
  v_used int;
  v_available int;
  v_progress_pct int;
  v_remaining numeric;
  v_qualifying_count int;
begin
  select * into v_config from public.wheel_config where active = true order by created_date desc limit 1;
  if v_config.id is null then
    return jsonb_build_object('active', false);
  end if;
  if v_config.start_date is not null and v_now < v_config.start_date then
    return jsonb_build_object('active', false, 'config', to_jsonb(v_config), 'pending', true);
  end if;
  if v_config.end_date is not null and v_now > v_config.end_date then
    return jsonb_build_object('active', false, 'config', to_jsonb(v_config), 'expired', true);
  end if;

  v_min := coalesce(v_config.min_amount, 0);

  if v_config.basis = 'single_order' then
    select count(*) into v_qualifying_count from public.orders
    where created_by_id = p_user_id
      and status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
      and coalesce(subtotal, 0) >= v_min;
    v_eligible := v_qualifying_count;
    v_earned := v_qualifying_count;
  elsif v_config.basis = 'period' then
    select coalesce(sum(greatest(0, coalesce(subtotal, 0) - coalesce(discount_amount, 0) - coalesce(loyalty_discount, 0))), 0)
      into v_eligible
    from public.orders
    where created_by_id = p_user_id
      and status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
      and (v_config.period_start is null or created_date >= v_config.period_start)
      and (v_config.period_end is null or created_date <= v_config.period_end);
    v_earned := case when v_min > 0 then floor(v_eligible / v_min)::int else 0 end;
  else
    select coalesce(sum(greatest(0, coalesce(subtotal, 0) - coalesce(discount_amount, 0) - coalesce(loyalty_discount, 0))), 0)
      into v_eligible
    from public.orders
    where created_by_id = p_user_id
      and status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery');
    v_earned := case when v_min > 0 then floor(v_eligible / v_min)::int else 0 end;
  end if;

  v_progress := public.get_or_create_wheel_progress(p_user_id, p_user_email);
  if v_progress.free_spin_granted then v_earned := v_earned + 1; end if;

  select count(*) into v_used from public.wheel_spins where user_email = p_user_email;
  v_available := greatest(0, v_earned - v_used);
  v_progress_pct := case when v_min > 0 then least(100, round((v_eligible - v_min * floor(v_eligible / v_min)) / v_min * 100)::int) else 100 end;
  v_remaining := case when v_min > 0 then greatest(0, v_min - (v_eligible - v_min * floor(v_eligible / v_min))) else 0 end;

  return jsonb_build_object(
    'active', true, 'config', to_jsonb(v_config), 'progress', to_jsonb(v_progress),
    'eligible_amount', v_eligible, 'min_amount', v_min, 'earned', v_earned, 'used', v_used,
    'available', v_available, 'progress_pct', v_progress_pct, 'remaining_amount', v_remaining
  );
end;
$$;
revoke execute on function public.compute_wheel_state(uuid, text) from public, anon, authenticated;

-- ── wheelState ───────────────────────────────────────────────────────────
create or replace function public.wheel_state()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
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
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_rewards from public.wheel_rewards r where active = true;
  return jsonb_build_object('success', true) || v_state || jsonb_build_object('rewards', v_rewards);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.wheel_state() from public, anon;
grant execute on function public.wheel_state() to authenticated;

-- ── wheelSpin ────────────────────────────────────────────────────────────
create or replace function public.wheel_spin()
returns jsonb
language plpgsql
security definer set search_path = public
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
revoke execute on function public.wheel_spin() from public, anon;
grant execute on function public.wheel_spin() to authenticated;

-- ── wheelGrantFirstSpin ──────────────────────────────────────────────────
create or replace function public.wheel_grant_first_spin()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_state jsonb;
  v_config jsonb;
  v_progress_id uuid;
  v_created_at timestamptz;
  v_start_date date;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  v_state := public.compute_wheel_state(v_uid, v_email);
  if not coalesce((v_state->>'active')::boolean, false) then
    return jsonb_build_object('success', false, 'message', 'Wheel is not active');
  end if;
  v_config := v_state->'config';
  if not coalesce((v_config->>'first_time_enabled')::boolean, false) then
    return jsonb_build_object('success', false, 'message', 'First-time spin is disabled');
  end if;
  if coalesce((v_state->'progress'->>'free_spin_granted')::boolean, false) then
    return jsonb_build_object('success', false, 'message', 'Free spin already claimed');
  end if;
  if coalesce((v_config->>'first_time_new_only')::boolean, false) and (v_config->>'start_date') is not null then
    select created_at into v_created_at from public.profiles where id = v_uid;
    v_start_date := (v_config->>'start_date')::date;
    if v_created_at is null or v_created_at < v_start_date then
      return jsonb_build_object('success', false, 'message', 'Free spin is for new customers only');
    end if;
  end if;

  v_progress_id := (v_state->'progress'->>'id')::uuid;
  update public.wheel_progress set
    free_spin_granted = true,
    spins_earned = coalesce((v_state->'progress'->>'spins_earned')::int, 0) + 1,
    last_activity_at = now(), updated_date = now()
  where id = v_progress_id;

  perform public.record_reward(
    v_uid, v_email, 'firsttime', null, coalesce(v_config->>'name', 'Mystery Wheel'), '',
    'free_spin', 'Free Mystery Wheel Spin', '', 0, '', null, 0, 'auto'
  );

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.wheel_grant_first_spin() from public, anon;
grant execute on function public.wheel_grant_first_spin() to authenticated;

-- ── finalizeWheelRewards ─────────────────────────────────────────────────
create or replace function public.finalize_wheel_rewards(p_order_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_order public.orders;
  v_is_owner boolean;
  v_items jsonb;
  v_spin_ids uuid[];
  v_sid uuid;
  v_spin public.wheel_spins;
  v_marked int := 0;
  v_repriced int := 0;
  v_expired boolean;
  v_already_used boolean;
  v_new_items jsonb;
  v_subtotal numeric;
  v_total numeric;
  v_dc public.discount_codes;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;
  v_is_owner := (v_order.created_by_id = v_uid) or (v_order.customer_email = v_email);
  if not v_is_owner and not is_admin() then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  v_items := coalesce(v_order.items, '[]'::jsonb);
  select coalesce(array_agg(distinct (it->>'wheel_spin_id')::uuid), '{}')
    into v_spin_ids
  from jsonb_array_elements(v_items) it
  where (it->>'wheel_spin_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  foreach v_sid in array v_spin_ids loop
    select * into v_spin from public.wheel_spins where id = v_sid;
    if not found then continue; end if;
    if v_spin.user_email <> v_order.customer_email then continue; end if;

    v_expired := v_spin.expires_at is not null and v_spin.expires_at < now();
    v_already_used := v_spin.status = 'used' and v_spin.redeemed_order_id is not null and v_spin.redeemed_order_id <> p_order_id;

    if v_spin.status = 'unused' and not v_expired then
      update public.wheel_spins set status = 'used', redeemed_order_id = p_order_id, updated_date = now() where id = v_sid;
      v_marked := v_marked + 1;
    elsif v_already_used or v_expired or v_spin.status = 'unavailable' then
      select jsonb_agg(
        case when (it->>'wheel_spin_id') = v_sid::text and coalesce((it->>'is_wheel_reward')::boolean, false) then
          it || jsonb_build_object('price', coalesce(v_spin.product_price, 0), 'is_wheel_reward', false, 'wheel_reward_reversed', true)
        else it end
      ) into v_new_items
      from jsonb_array_elements(v_items) it;

      if v_new_items is distinct from v_items then
        select coalesce(sum(coalesce((it->>'price')::numeric, 0) * coalesce((it->>'qty')::numeric, 0)), 0) into v_subtotal
        from jsonb_array_elements(v_new_items) it;
        v_total := greatest(0, v_subtotal + coalesce(v_order.delivery_cost, 0) - coalesce(v_order.discount_amount, 0) - coalesce(v_order.loyalty_discount, 0));
        update public.orders set
          items = v_new_items, subtotal = v_subtotal, total = v_total,
          internal_notes = coalesce(internal_notes, '') || E'\nWheel reward ' || v_sid::text || ' ' || (case when v_expired then 'expired' else 'already used' end) || '; free line re-priced.',
          updated_date = now()
        where id = p_order_id;
        v_items := v_new_items;
        v_repriced := v_repriced + 1;
      end if;
      if v_expired and v_spin.status <> 'expired' then
        update public.wheel_spins set status = 'expired', updated_date = now() where id = v_sid;
      end if;
    end if;
  end loop;

  if v_order.discount_code is not null then
    select * into v_dc from public.discount_codes where code = v_order.discount_code limit 1;
    if v_dc.id is not null and v_dc.wheel_spin_id is not null then
      select * into v_spin from public.wheel_spins where id = v_dc.wheel_spin_id;
      if v_spin.id is not null and v_spin.status = 'unused'
         and (v_spin.expires_at is null or v_spin.expires_at >= now())
         and v_spin.user_email = v_order.customer_email then
        update public.wheel_spins set status = 'used', redeemed_order_id = p_order_id, updated_date = now() where id = v_spin.id;
        v_marked := v_marked + 1;
      end if;
    end if;
  end if;

  return jsonb_build_object('success', true, 'marked', v_marked, 'repriced', v_repriced);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.finalize_wheel_rewards(uuid) from public, anon;
grant execute on function public.finalize_wheel_rewards(uuid) to authenticated;

-- ── reverseWheelRewards ──────────────────────────────────────────────────
create or replace function public.reverse_wheel_rewards(p_order_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_items jsonb;
  v_spin_ids uuid[];
  v_sid uuid;
  v_spin public.wheel_spins;
  v_reverted int := 0;
  v_expired boolean;
  v_dc public.discount_codes;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if not has_permission('orders.manage') then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Order not found');
  end if;

  v_items := coalesce(v_order.items, '[]'::jsonb);
  select coalesce(array_agg(distinct (it->>'wheel_spin_id')::uuid), '{}') into v_spin_ids
  from jsonb_array_elements(v_items) it
  where (it->>'wheel_spin_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  foreach v_sid in array v_spin_ids loop
    select * into v_spin from public.wheel_spins where id = v_sid;
    if not found then continue; end if;
    if v_spin.redeemed_order_id = p_order_id and v_spin.status = 'used' then
      v_expired := v_spin.expires_at is not null and v_spin.expires_at < now();
      update public.wheel_spins set status = case when v_expired then 'expired' else 'unused' end, redeemed_order_id = null, updated_date = now() where id = v_sid;
      v_reverted := v_reverted + 1;
    end if;
  end loop;

  if v_order.discount_code is not null then
    select * into v_dc from public.discount_codes where code = v_order.discount_code limit 1;
    if v_dc.id is not null and v_dc.wheel_spin_id is not null and v_order.discount_counted then
      select * into v_spin from public.wheel_spins where id = v_dc.wheel_spin_id;
      if v_spin.id is not null and v_spin.redeemed_order_id = p_order_id then
        v_expired := v_spin.expires_at is not null and v_spin.expires_at < now();
        update public.wheel_spins set status = case when v_expired then 'expired' else 'unused' end, redeemed_order_id = null, updated_date = now() where id = v_spin.id;
        v_reverted := v_reverted + 1;
      end if;
      update public.discount_codes set used_count = greatest(0, coalesce(used_count, 0) - 1), updated_date = now() where id = v_dc.id;
      update public.orders set discount_counted = false, updated_date = now() where id = p_order_id;
    end if;
  end if;

  return jsonb_build_object('success', true, 'reverted', v_reverted);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.reverse_wheel_rewards(uuid) from public, anon;
grant execute on function public.reverse_wheel_rewards(uuid) to authenticated;

-- ── challengesClaim ──────────────────────────────────────────────────────
create or replace function public.challenges_claim(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_challenge public.challenges;
  v_progress public.challenge_progress;
  v_now timestamptz := now();
  v_within boolean;
  v_avail int;
  v_new_rewarded int;
  v_discount_code text := '';
  v_points int := 0;
  v_fulfillment text := 'auto';
  v_reward_label text;
  v_order_id uuid;
  v_dc public.discount_codes;
  v_count_target int;
  v_valid_count int;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  select * into v_challenge from public.challenges where id = p_challenge_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Challenge not found');
  end if;
  if not coalesce(v_challenge.active, false) or not (
    (v_challenge.start_date is null or v_now >= v_challenge.start_date) and
    (v_challenge.end_date is null or v_now <= v_challenge.end_date)
  ) then
    return jsonb_build_object('success', false, 'message', 'Challenge is not active');
  end if;
  if v_challenge.type = 'photo_upload' then
    return jsonb_build_object('success', false, 'message', 'Submit a photo for this challenge');
  end if;
  if v_challenge.type = 'custom' then
    return jsonb_build_object('success', false, 'message', 'This challenge is completed manually by the store');
  end if;

  v_progress := public.get_or_create_challenge_progress(p_challenge_id, v_uid, v_email);

  v_within := case v_challenge.frequency
    when 'unlimited' then true
    when 'custom' then coalesce(v_progress.rewarded_count, 0) < coalesce(v_challenge.limit_count, 1)
    when 'daily' then v_progress.last_completed_at is null or (v_now - v_progress.last_completed_at) > interval '24 hours'
    when 'weekly' then v_progress.last_completed_at is null or (v_now - v_progress.last_completed_at) > interval '7 days'
    when 'monthly' then v_progress.last_completed_at is null or (v_now - v_progress.last_completed_at) > interval '30 days'
    else coalesce(v_progress.rewarded_count, 0) < 1
  end;
  if not v_within then
    return jsonb_build_object('success', false, 'message', 'Already completed for this period');
  end if;

  if v_challenge.type = 'product_purchase' then
    if v_challenge.target->>'product_id' is null then
      v_avail := 0;
    else
      select count(*) into v_avail
      from public.orders o
      where o.created_by_id = v_uid
        and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
        and exists (select 1 from jsonb_array_elements(o.items) it where it->>'id' = v_challenge.target->>'product_id')
        and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')));
    end if;
  elsif v_challenge.type = 'spend_amount' then
    select count(*) into v_avail
    from public.orders o
    where o.created_by_id = v_uid
      and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
      and coalesce(o.subtotal, 0) >= coalesce((v_challenge.target->>'amount')::numeric, 0)
      and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')));
  elsif v_challenge.type = 'purchase_count' then
    v_count_target := greatest(1, coalesce((v_challenge.target->>'count')::int, 0));
    select count(*) into v_valid_count from public.orders
    where created_by_id = v_uid and status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery');
    v_avail := greatest(0, (v_valid_count / v_count_target) - coalesce(v_progress.rewarded_count, 0));
  elsif v_challenge.type = 'share' then
    v_avail := case when coalesce(array_length(v_progress.recipients, 1), 0) >= coalesce((v_challenge.target->>'share_count')::int, 0) then 1 else 0 end;
  else
    v_avail := 0;
  end if;

  if v_avail <= 0 then
    return jsonb_build_object('success', false, 'message', 'Requirement not met yet');
  end if;

  v_new_rewarded := coalesce(v_progress.rewarded_count, 0) + 1;
  v_reward_label := coalesce(nullif(v_challenge.reward_label, ''), case when v_challenge.reward_type = 'points' then '+' || v_challenge.reward_value || ' points' else v_challenge.name end);

  if v_challenge.reward_type = 'points' then
    v_points := trunc(coalesce(v_challenge.reward_value, 0))::int;
    perform public.grant_reward_points(v_uid, v_email, v_points, 'Challenge: ' || v_challenge.name, 'chl-' || p_challenge_id::text || '-' || v_uid::text || '-' || v_new_rewarded::text);
  elsif v_challenge.reward_type in ('discount_percent', 'discount_fixed', 'credit') then
    v_dc := public.grant_discount_code_record(
      coalesce(v_challenge.reward_code_prefix, 'CHL'),
      case when v_challenge.reward_type = 'discount_percent' then 'percent' else 'fixed' end,
      v_challenge.reward_value, v_challenge.end_date, v_email, null, 'challenge',
      'Challenge: ' || v_challenge.name
    );
    v_discount_code := v_dc.code;
  else
    v_fulfillment := 'manual';
  end if;

  if v_challenge.type = 'product_purchase' then
    select o.id into v_order_id from public.orders o
    where o.created_by_id = v_uid
      and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
      and exists (select 1 from jsonb_array_elements(o.items) it where it->>'id' = v_challenge.target->>'product_id')
      and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')))
    limit 1;
  elsif v_challenge.type = 'spend_amount' then
    select o.id into v_order_id from public.orders o
    where o.created_by_id = v_uid
      and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
      and coalesce(o.subtotal, 0) >= coalesce((v_challenge.target->>'amount')::numeric, 0)
      and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')))
    limit 1;
  end if;

  update public.challenge_progress set
    rewarded_count = v_new_rewarded,
    completions = coalesce(completions, 0) + 1,
    last_completed_at = v_now,
    rewarded_order_ids = case when v_order_id is not null then array_append(coalesce(rewarded_order_ids, '{}'), v_order_id::text) else rewarded_order_ids end,
    updated_date = now()
  where id = v_progress.id;

  perform public.record_reward(
    v_uid, v_email, 'challenge', p_challenge_id::text, v_challenge.name, coalesce(v_challenge.name_en, ''),
    v_challenge.reward_type, v_reward_label, coalesce(v_challenge.reward_label_en, ''),
    v_points, v_discount_code, v_challenge.product_id,
    case when v_challenge.reward_type = 'credit' then coalesce(v_challenge.reward_value, 0) else 0 end,
    v_fulfillment
  );

  return jsonb_build_object('success', true, 'reward_type', v_challenge.reward_type, 'reward_label', v_reward_label, 'points', v_points, 'discount_code', v_discount_code, 'fulfillment', v_fulfillment);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.challenges_claim(uuid) from public, anon;
grant execute on function public.challenges_claim(uuid) to authenticated;

-- ── challengesSubmitPhoto ────────────────────────────────────────────────
create or replace function public.challenges_submit_photo(p_challenge_id uuid, p_file_url text, p_note text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_challenge public.challenges;
  v_file_url text := trim(coalesce(p_file_url, ''));
  v_has_active boolean;
  v_submission public.challenge_submissions;
  v_status text;
  v_progress public.challenge_progress;
  v_new_rewarded int;
  v_points int := 0;
  v_discount_code text := '';
  v_dc public.discount_codes;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if p_challenge_id is null or v_file_url = '' then
    return jsonb_build_object('success', false, 'message', 'challenge_id and file_url required');
  end if;

  select * into v_challenge from public.challenges where id = p_challenge_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Challenge not found');
  end if;
  if v_challenge.type <> 'photo_upload' then
    return jsonb_build_object('success', false, 'message', 'Not a photo challenge');
  end if;
  if not coalesce(v_challenge.active, false) or not (
    (v_challenge.start_date is null or now() >= v_challenge.start_date) and
    (v_challenge.end_date is null or now() <= v_challenge.end_date)
  ) then
    return jsonb_build_object('success', false, 'message', 'Challenge is not active');
  end if;

  select exists (
    select 1 from public.challenge_submissions
    where challenge_id = p_challenge_id and user_email = v_email
      and (status = 'pending' or (status = 'approved' and reward_granted))
  ) into v_has_active;
  if v_has_active then
    return jsonb_build_object('success', false, 'message', 'You already submitted this challenge');
  end if;

  v_status := case when coalesce(v_challenge.requires_review, false) then 'pending' else 'approved' end;

  insert into public.challenge_submissions (
    challenge_id, challenge_name, challenge_name_en, user_id, user_email, file_url, note, status, reward_granted
  ) values (
    p_challenge_id, v_challenge.name, coalesce(v_challenge.name_en, ''), v_uid, v_email, v_file_url, coalesce(p_note, ''), v_status, false
  ) returning * into v_submission;

  if not coalesce(v_challenge.requires_review, false) then
    v_progress := public.get_or_create_challenge_progress(p_challenge_id, v_uid, v_email);
    v_new_rewarded := coalesce(v_progress.rewarded_count, 0) + 1;

    if v_challenge.reward_type = 'points' then
      v_points := trunc(coalesce(v_challenge.reward_value, 0))::int;
      perform public.grant_reward_points(v_uid, v_email, v_points, 'Challenge: ' || v_challenge.name, 'chl-' || p_challenge_id::text || '-' || v_uid::text || '-' || v_new_rewarded::text);
    elsif v_challenge.reward_type in ('discount_percent', 'discount_fixed', 'credit') then
      v_dc := public.grant_discount_code_record(
        coalesce(v_challenge.reward_code_prefix, 'CHL'),
        case when v_challenge.reward_type = 'discount_percent' then 'percent' else 'fixed' end,
        v_challenge.reward_value, v_challenge.end_date, v_email, null, 'challenge', 'Challenge: ' || v_challenge.name
      );
      v_discount_code := v_dc.code;
    end if;

    update public.challenge_submissions set reward_granted = true, updated_date = now() where id = v_submission.id;
    update public.challenge_progress set
      rewarded_count = v_new_rewarded, completions = coalesce(completions, 0) + 1, last_completed_at = now(), updated_date = now()
    where id = v_progress.id;

    perform public.record_reward(
      v_uid, v_email, 'challenge', p_challenge_id::text, v_challenge.name, coalesce(v_challenge.name_en, ''),
      v_challenge.reward_type, coalesce(nullif(v_challenge.reward_label, ''), v_challenge.name), coalesce(v_challenge.reward_label_en, ''),
      v_points, v_discount_code, v_challenge.product_id,
      case when v_challenge.reward_type = 'credit' then coalesce(v_challenge.reward_value, 0) else 0 end, 'auto'
    );
  end if;

  return jsonb_build_object('success', true, 'status', v_status, 'requires_review', coalesce(v_challenge.requires_review, false));
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.challenges_submit_photo(uuid, text, text) from public, anon;
grant execute on function public.challenges_submit_photo(uuid, text, text) to authenticated;

-- ── challengesReview ─────────────────────────────────────────────────────
create or replace function public.challenges_review(p_submission_id uuid, p_action text default 'approve', p_note text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := case when p_action = 'reject' then 'reject' else 'approve' end;
  v_sub public.challenge_submissions;
  v_challenge public.challenges;
  v_progress public.challenge_progress;
  v_new_rewarded int;
  v_points int := 0;
  v_discount_code text := '';
  v_dc public.discount_codes;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;
  if not has_permission('loyalty.add') then
    return jsonb_build_object('success', false, 'message', 'Forbidden');
  end if;

  select * into v_sub from public.challenge_submissions where id = p_submission_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Submission not found');
  end if;

  if v_action = 'reject' then
    update public.challenge_submissions set status = 'rejected', reviewed_by = auth.jwt() ->> 'email', review_note = coalesce(p_note, ''), updated_date = now() where id = v_sub.id;
    return jsonb_build_object('success', true, 'status', 'rejected');
  end if;

  if v_sub.reward_granted then
    return jsonb_build_object('success', false, 'message', 'Reward already granted');
  end if;

  select * into v_challenge from public.challenges where id = v_sub.challenge_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Challenge not found');
  end if;

  select * into v_progress from public.challenge_progress where challenge_id = v_sub.challenge_id and user_email = v_sub.user_email limit 1;
  v_new_rewarded := coalesce(v_progress.rewarded_count, 0) + 1;

  if v_challenge.reward_type = 'points' then
    v_points := trunc(coalesce(v_challenge.reward_value, 0))::int;
    perform public.grant_reward_points(v_sub.user_id, v_sub.user_email, v_points, 'Challenge: ' || v_challenge.name, 'chl-' || v_sub.challenge_id::text || '-' || v_sub.user_email || '-' || v_new_rewarded::text);
  elsif v_challenge.reward_type in ('discount_percent', 'discount_fixed', 'credit') then
    v_dc := public.grant_discount_code_record(
      coalesce(v_challenge.reward_code_prefix, 'CHL'),
      case when v_challenge.reward_type = 'discount_percent' then 'percent' else 'fixed' end,
      v_challenge.reward_value, v_challenge.end_date, v_sub.user_email, null, 'challenge', 'Challenge: ' || v_challenge.name
    );
    v_discount_code := v_dc.code;
  end if;

  update public.challenge_submissions set status = 'approved', reviewed_by = auth.jwt() ->> 'email', review_note = coalesce(p_note, ''), reward_granted = true, updated_date = now() where id = v_sub.id;

  if v_progress.id is not null then
    update public.challenge_progress set rewarded_count = v_new_rewarded, completions = coalesce(completions, 0) + 1, last_completed_at = now(), updated_date = now() where id = v_progress.id;
  end if;

  perform public.record_reward(
    v_sub.user_id, v_sub.user_email, 'challenge', v_sub.challenge_id::text, v_challenge.name, coalesce(v_challenge.name_en, ''),
    v_challenge.reward_type, coalesce(nullif(v_challenge.reward_label, ''), v_challenge.name), coalesce(v_challenge.reward_label_en, ''),
    v_points, v_discount_code, v_challenge.product_id,
    case when v_challenge.reward_type = 'credit' then coalesce(v_challenge.reward_value, 0) else 0 end, 'auto'
  );

  return jsonb_build_object('success', true, 'status', 'approved', 'points', v_points, 'discount_code', v_discount_code);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.challenges_review(uuid, text, text) from public, anon;
grant execute on function public.challenges_review(uuid, text, text) to authenticated;
