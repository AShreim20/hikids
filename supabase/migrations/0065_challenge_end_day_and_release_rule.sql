-- Challenge order rules, aligned with the Mystery Wheel.
--
-- 1) The end date is a whole day. 0064 compared against end_date::timestamptz
--    (00:00 at the START of that day), so orders placed ON the end date never
--    counted. The window now runs up to, but not including, 00:00 of the day
--    AFTER end_date (same UTC-midnight convention as start_date).
--
-- 2) An order only counts once its rewards are released, exactly like the wheel
--    (_wheel_purchase): not rewards_managed, or rewards_released_at is set
--    (3 days after delivery, no active return). Before, any order that was not
--    yet cancelled counted immediately, so a customer could place an order,
--    claim the reward, then cancel/return it and keep the reward.
--
-- One shared definition of "which orders count" is used by the claim path so it
-- cannot drift. The Challenges page mirrors it for the progress display.

create or replace function public.challenge_end_exclusive(p_end date)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case when p_end is null then null else (p_end + 1)::timestamptz end;
$$;

create or replace function public.challenge_qualifying_orders(p_uid uuid, p_start timestamptz, p_end_exclusive timestamptz)
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select o.*
  from public.orders o
  where o.created_by_id = p_uid
    and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
    and o.created_date >= p_start
    and (p_end_exclusive is null or o.created_date < p_end_exclusive)
    and (not o.rewards_managed or o.rewards_released_at is not null);
$$;

revoke execute on function public.challenge_qualifying_orders(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.challenge_end_exclusive(date) from public, anon;
grant execute on function public.challenge_end_exclusive(date) to authenticated;

create or replace function public.challenge_accepts_activity(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = p_challenge_id
      and c.active
      and c.starts_at is not null
      and now() >= c.starts_at
      and (c.start_date is null or now() >= c.start_date::timestamptz)
      and (c.end_date is null or now() < public.challenge_end_exclusive(c.end_date))
  );
$$;

revoke execute on function public.challenge_accepts_activity(uuid) from public, anon, authenticated;

-- challenges_claim: identical to 0064 except order lookups go through
-- challenge_qualifying_orders() and the end boundary is the exclusive one.
create or replace function public.challenges_claim(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_challenge public.challenges;
  v_progress public.challenge_progress;
  v_now timestamptz := now();
  v_start timestamptz;
  v_end timestamptz;
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
  if not public.challenge_accepts_activity(p_challenge_id) then
    return jsonb_build_object('success', false, 'message', 'Challenge is not active');
  end if;
  if v_challenge.type = 'photo_upload' then
    return jsonb_build_object('success', false, 'message', 'Submit a photo for this challenge');
  end if;
  if v_challenge.type = 'custom' then
    return jsonb_build_object('success', false, 'message', 'This challenge is completed manually by the store');
  end if;

  -- Eligibility window for customer activity.
  v_start := v_challenge.starts_at;
  v_end := public.challenge_end_exclusive(v_challenge.end_date);

  v_progress := public.get_or_create_challenge_progress(p_challenge_id, v_uid, v_email);
  select * into v_progress from public.challenge_progress where id = v_progress.id for update;

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
      from public.challenge_qualifying_orders(v_uid, v_start, v_end) o
      where exists (select 1 from jsonb_array_elements(o.items) it where it->>'id' = v_challenge.target->>'product_id')
        and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')));
    end if;
  elsif v_challenge.type = 'spend_amount' then
    select count(*) into v_avail
    from public.challenge_qualifying_orders(v_uid, v_start, v_end) o
    where coalesce(o.subtotal, 0) >= coalesce((v_challenge.target->>'amount')::numeric, 0)
      and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')));
  elsif v_challenge.type = 'purchase_count' then
    v_count_target := greatest(1, coalesce((v_challenge.target->>'count')::int, 0));
    select count(*) into v_valid_count from public.challenge_qualifying_orders(v_uid, v_start, v_end) o;
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
    select o.id into v_order_id from public.challenge_qualifying_orders(v_uid, v_start, v_end) o
    where exists (select 1 from jsonb_array_elements(o.items) it where it->>'id' = v_challenge.target->>'product_id')
      and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')))
    order by o.created_date
    limit 1;
  elsif v_challenge.type = 'spend_amount' then
    select o.id into v_order_id from public.challenge_qualifying_orders(v_uid, v_start, v_end) o
    where coalesce(o.subtotal, 0) >= coalesce((v_challenge.target->>'amount')::numeric, 0)
      and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')))
    order by o.created_date
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
$function$;
