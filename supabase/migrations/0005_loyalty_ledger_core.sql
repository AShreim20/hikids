-- Loyalty ledger core (post_ledger + get_or_create_wallet), ported from
-- base44/shared/loyalty.ts. Introduced now because reviewPhoto (Phase 3) is
-- the first consumer, but designed as the general-purpose ledger poster all
-- 9 loyalty functions will share in Phase 6 -- the lifetime_earned/spent/
-- removed/expired_points bucket logic below mirrors postLedger()'s
-- if/else-if chain exactly (branch priority and exclusivity preserved).

alter table public.loyalty_accounts add constraint loyalty_accounts_user_email_key unique (user_email);

create sequence if not exists public.loyalty_wallet_code_seq start 1;

create or replace function public.get_or_create_wallet(
  p_user_id uuid, p_user_email text, p_user_name text default null, p_user_phone text default null
) returns public.loyalty_accounts
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet public.loyalty_accounts;
begin
  insert into public.loyalty_accounts (user_id, user_email, user_name, user_phone, wallet_code, status)
  values (
    p_user_id, p_user_email, p_user_name, p_user_phone,
    'LW-' || lpad(nextval('public.loyalty_wallet_code_seq')::text, 6, '0'),
    'active'
  )
  on conflict (user_email) do nothing
  returning * into v_wallet;

  if v_wallet.id is null then
    select * into v_wallet from public.loyalty_accounts where user_email = p_user_email;
  end if;
  return v_wallet;
end;
$$;

revoke execute on function public.get_or_create_wallet(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.post_ledger(
  p_wallet_id uuid,
  p_points int,
  p_type text,
  p_reason text default null,
  p_order_id uuid default null,
  p_actor_email text default null,
  p_idempotency_key text default null,
  p_expires_at timestamptz default null,
  p_reference_transaction_id uuid default null
) returns public.loyalty_transactions
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet public.loyalty_accounts;
  v_before int;
  v_after int;
  v_tx public.loyalty_transactions;
begin
  select * into v_wallet from public.loyalty_accounts where id = p_wallet_id for update;
  if v_wallet.id is null then
    raise exception 'wallet_not_found';
  end if;

  v_before := coalesce(v_wallet.balance, 0);
  v_after := v_before + p_points;
  if v_after < 0 then
    raise exception 'insufficient_points';
  end if;

  if p_idempotency_key is not null and p_idempotency_key <> '' then
    insert into public.loyalty_transactions (
      account_id, wallet_code, user_id, user_email, points, type, reason, order_id,
      actor_email, balance_before, balance_after, idempotency_key, expires_at, reference_transaction_id
    ) values (
      p_wallet_id, v_wallet.wallet_code, v_wallet.user_id, v_wallet.user_email, p_points, p_type, p_reason, p_order_id,
      p_actor_email, v_before, v_after, p_idempotency_key, p_expires_at, p_reference_transaction_id
    )
    on conflict (idempotency_key) do nothing
    returning * into v_tx;

    if v_tx.id is null then
      select * into v_tx from public.loyalty_transactions where idempotency_key = p_idempotency_key;
      return v_tx;
    end if;
  else
    insert into public.loyalty_transactions (
      account_id, wallet_code, user_id, user_email, points, type, reason, order_id,
      actor_email, balance_before, balance_after, expires_at, reference_transaction_id
    ) values (
      p_wallet_id, v_wallet.wallet_code, v_wallet.user_id, v_wallet.user_email, p_points, p_type, p_reason, p_order_id,
      p_actor_email, v_before, v_after, p_expires_at, p_reference_transaction_id
    )
    returning * into v_tx;
  end if;

  update public.loyalty_accounts set
    balance = v_after,
    last_activity_at = now(),
    lifetime_earned = case
      when p_type in ('PURCHASE_REWARD','ADMIN_CREDIT') or (p_points > 0 and p_type = 'ADJUSTMENT')
        then lifetime_earned + p_points
      when p_type = 'RETURN_REVERSAL' and p_points < 0
        then greatest(0, lifetime_earned - (-p_points))
      else lifetime_earned
    end,
    lifetime_spent = case
      when p_type = 'REDEMPTION' then lifetime_spent + (-p_points)
      when p_type in ('REFUND','CANCELLATION_REVERSAL') then greatest(0, lifetime_spent - p_points)
      else lifetime_spent
    end,
    expired_points = case when p_type = 'EXPIRED' then expired_points + (-p_points) else expired_points end,
    lifetime_removed = case
      when p_type = 'EXPIRED' then lifetime_removed + (-p_points)
      when p_type not in ('REDEMPTION','REFUND','CANCELLATION_REVERSAL','EXPIRED') and p_points < 0
        then lifetime_removed + (-p_points)
      else lifetime_removed
    end
  where id = p_wallet_id;

  return v_tx;
end;
$$;

revoke execute on function public.post_ledger(uuid, int, text, text, uuid, text, text, timestamptz, uuid) from public, anon, authenticated;
