-- Challenge eligibility boundary.
--
-- BUG: challenges_claim() looked at a customer's ENTIRE order history. A
-- brand-new "Buy product X" / "Spend ₪300" / "Make 3 purchases" challenge was
-- therefore completed instantly by orders placed days or months before it
-- existed (nothing compared the order's date to the challenge at all). The
-- Challenges page did the same maths client-side, so it also showed such a
-- challenge as already done.
--
-- FIX: a challenge gets an explicit eligibility start, `starts_at`. Only
-- activity at or after it counts, and only up to the end date when there is one.
--
-- Lifecycle (enforced here, in the database — never trusted from the client):
--   * Created active          -> starts_at = now() (or the configured start date
--                                if that is later).
--   * Created as draft        -> starts_at stays NULL. A draft can't be
--                                participated in, so nothing done meanwhile counts.
--   * Draft -> active (first) -> starts_at = now() (or the configured start date
--                                if later). Activity during the draft never counts.
--   * Edits (names, text, reward label, image...) -> starts_at never moves.
--   * Switch off, then on again -> starts_at is preserved (a temporary disable
--                                is not a new campaign).
--   * Admin changes the Start date -> the boundary may only move LATER; a start
--                                date in the past can never backdate eligibility
--                                to before the challenge was activated.
--   A client-supplied starts_at is always ignored.

alter table public.challenges
  add column if not exists starts_at timestamptz;

-- Existing challenges. Nobody's progress, rewards or history is touched.
--   * currently active  -> they have been live since they were created, so the
--                          boundary is the later of created_date and the configured
--                          start date (the same instant the existing "is it open
--                          yet" check already uses). Activity from before the
--                          challenge existed — the bug — stops counting; every
--                          genuine post-creation action keeps counting.
--   * currently inactive -> left NULL: they start fresh at their next activation,
--                          so nothing from the past can be claimed retroactively.
-- updated_date is deliberately not bumped by this backfill.
alter table public.challenges disable trigger challenges_set_updated_date;
update public.challenges
   set starts_at = greatest(created_date, coalesce(start_date::timestamptz, created_date))
 where active and starts_at is null;
alter table public.challenges enable trigger challenges_set_updated_date;

create or replace function public.challenges_set_starts_at()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- Same expression the existing availability checks use (date -> timestamptz).
  v_configured timestamptz := case when new.start_date is null then null else new.start_date::timestamptz end;
begin
  if tg_op = 'INSERT' then
    new.starts_at := case when coalesce(new.active, false)
      then greatest(now(), coalesce(v_configured, now())) else null end;
    return new;
  end if;

  -- UPDATE: an edit never moves the boundary by itself (and a value sent by the
  -- client is discarded).
  new.starts_at := old.starts_at;
  if old.starts_at is null then
    if coalesce(new.active, false) then
      new.starts_at := greatest(now(), coalesce(v_configured, now()));
    end if;
  elsif new.start_date is distinct from old.start_date and v_configured is not null then
    new.starts_at := greatest(old.starts_at, v_configured);
  end if;
  return new;
end;
$$;

drop trigger if exists challenges_set_starts_at on public.challenges;
create trigger challenges_set_starts_at
  before insert or update on public.challenges
  for each row execute function public.challenges_set_starts_at();

-- Single definition of "may customer activity count for this challenge right
-- now?", shared by the claim, photo and share paths so they can never drift.
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
      and (c.end_date is null or now() <= c.end_date::timestamptz)
  );
$$;

revoke execute on function public.challenge_accepts_activity(uuid) from public, anon, authenticated;

-- Share challenges count visitors who open a link. A visit that happens while
-- the challenge is inactive, not started, or over must not be banked for later
-- (e.g. links still circulating while the challenge is switched off). Enforced
-- on the table so it holds no matter who writes (the recordShareView Edge
-- Function writes with the service role): a rejected visit simply leaves the
-- recipient list unchanged.
create or replace function public.challenge_progress_guard_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipients is distinct from old.recipients
     and coalesce(array_length(new.recipients, 1), 0) > coalesce(array_length(old.recipients, 1), 0)
     and not public.challenge_accepts_activity(new.challenge_id) then
    new.recipients := old.recipients;
  end if;
  return new;
end;
$$;

drop trigger if exists challenge_progress_guard_recipients on public.challenge_progress;
create trigger challenge_progress_guard_recipients
  before update of recipients on public.challenge_progress
  for each row execute function public.challenge_progress_guard_recipients();

revoke execute on function public.challenge_progress_guard_recipients() from public, anon, authenticated;
revoke execute on function public.challenges_set_starts_at() from public, anon, authenticated;

-- challenges_claim: identical to the live definition except
--   (1) availability goes through challenge_accepts_activity();
--   (2) every order-based requirement ADDS "order placed at/after starts_at and
--       not after the end date" on top of the existing rules (status filter,
--       already-rewarded-order exclusion, frequency) — nothing was loosened;
--   (3) the customer's progress row is locked (FOR UPDATE) before the
--       once/frequency check, so two simultaneous claims can't both pass it.
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
  v_end := case when v_challenge.end_date is null then null else v_challenge.end_date::timestamptz end;

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
      from public.orders o
      where o.created_by_id = v_uid
        and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
        and o.created_date >= v_start
        and (v_end is null or o.created_date <= v_end)
        and exists (select 1 from jsonb_array_elements(o.items) it where it->>'id' = v_challenge.target->>'product_id')
        and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')));
    end if;
  elsif v_challenge.type = 'spend_amount' then
    select count(*) into v_avail
    from public.orders o
    where o.created_by_id = v_uid
      and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
      and o.created_date >= v_start
      and (v_end is null or o.created_date <= v_end)
      and coalesce(o.subtotal, 0) >= coalesce((v_challenge.target->>'amount')::numeric, 0)
      and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')));
  elsif v_challenge.type = 'purchase_count' then
    v_count_target := greatest(1, coalesce((v_challenge.target->>'count')::int, 0));
    select count(*) into v_valid_count from public.orders o
    where o.created_by_id = v_uid
      and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
      and o.created_date >= v_start
      and (v_end is null or o.created_date <= v_end);
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
      and o.created_date >= v_start
      and (v_end is null or o.created_date <= v_end)
      and exists (select 1 from jsonb_array_elements(o.items) it where it->>'id' = v_challenge.target->>'product_id')
      and not (o.id::text = any(coalesce(v_progress.rewarded_order_ids, '{}')))
    order by o.created_date
    limit 1;
  elsif v_challenge.type = 'spend_amount' then
    select o.id into v_order_id from public.orders o
    where o.created_by_id = v_uid
      and o.status not in ('cancelled', 'returned', 'return_approved', 'failed_delivery')
      and o.created_date >= v_start
      and (v_end is null or o.created_date <= v_end)
      and coalesce(o.subtotal, 0) >= coalesce((v_challenge.target->>'amount')::numeric, 0)
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

-- challenges_submit_photo: identical to the live definition except the
-- availability check now goes through challenge_accepts_activity(), so a
-- photo can only be submitted while the challenge is genuinely open (a
-- submission IS the qualifying action for this type, and it is created now —
-- there is no historical data that could complete it).
create or replace function public.challenges_submit_photo(p_challenge_id uuid, p_file_url text, p_note text DEFAULT NULL::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if not public.challenge_accepts_activity(p_challenge_id) then
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
$function$;

-- challenges_review: identical to the live definition except an approval is
-- refused for a submission made before the challenge's eligibility start
-- (possible only if an admin later moved the start date forward). Approving a
-- submission that was made inside the window still works after the challenge
-- has ended — the qualifying action happened in time.
create or replace function public.challenges_review(p_submission_id uuid, p_action text DEFAULT 'approve'::text, p_note text DEFAULT NULL::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if v_challenge.starts_at is not null and v_sub.created_date < v_challenge.starts_at then
    return jsonb_build_object('success', false, 'message', 'Submission was made before this challenge started');
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
$function$;
