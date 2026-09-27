-- User-deletion integrity (P2).
--
-- Confirmed by investigation:
--  - admin_delete_user_account is atomic and admin-only, but several NO ACTION
--    FKs (staff/reviewer references) can block deletion outright.
--  - Several customer-identity columns have NO FK at all and were silently
--    left pointing at a deleted UUID (orphaned) after deletion.
--  - wallets/wallet_transactions (the return/exchange credit wallet) were
--    hard-deleted, destroying financial history that orders/loyalty preserve.
--  - The self-service deleteAccount Edge Function bypassed all of this by
--    calling auth.admin.deleteUser() directly.
--
-- This migration adds one shared internal cleanup helper, used by BOTH the
-- existing admin path and a new self-service RPC, so the logic lives once.

-- wallets/wallet_transactions.user_id are NOT NULL with a NO ACTION FK today
-- (every other historical table in this schema disowns via SET NULL instead
-- of losing the row) — the smallest schema change that lets wallet history
-- survive a user deletion is to make them nullable and switch the FK to
-- SET NULL, exactly like orders.created_by_id / reviews.created_by_id / etc.
alter table public.wallets alter column user_id drop not null;
alter table public.wallets
  drop constraint wallets_user_id_fkey,
  add constraint wallets_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

alter table public.wallet_transactions alter column user_id drop not null;
alter table public.wallet_transactions
  drop constraint wallet_transactions_user_id_fkey,
  add constraint wallet_transactions_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

-- Shared cleanup: disowns every reference to p_user_id across the app's
-- historical tables WITHOUT deleting any of those rows, so it is safe to run
-- before either deletion path removes the auth.users row.
--
-- Never granted to anon/authenticated directly — only admin_delete_user_account
-- and self_delete_account call it, after each has already verified who is
-- allowed to delete which account.
create or replace function public._cleanup_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- B) NO ACTION staff/reviewer references that would otherwise block
  -- `delete from auth.users` outright (confirmed by direct reproduction:
  -- return_requests.reviewed_by blocked deletion of a non-admin staff member).
  update public.return_requests set created_by_id = null where created_by_id = p_user_id;
  update public.return_requests set reviewed_by = null where reviewed_by = p_user_id;
  update public.return_request_items set created_by_id = null where created_by_id = p_user_id;
  update public.return_request_notes set created_by_id = null where created_by_id = p_user_id;
  update public.return_request_item_inspections set inspected_by = null where inspected_by = p_user_id;
  update public.return_request_item_receipts set received_by = null where received_by = p_user_id;
  update public.return_settlements set confirmed_by = null where confirmed_by = p_user_id;
  update public.return_settlements set created_by_id = null where created_by_id = p_user_id;
  update public.return_settlements set reversed_by = null where reversed_by = p_user_id;
  update public.return_refunds set completed_by = null where completed_by = p_user_id;
  update public.return_refunds set created_by_id = null where created_by_id = p_user_id;
  update public.return_reasons set created_by_id = null where created_by_id = p_user_id;
  update public.expenses set created_by_id = null where created_by_id = p_user_id;
  update public.expense_categories set created_by_id = null where created_by_id = p_user_id;
  update public.inventory_movements set created_by = null where created_by = p_user_id;
  update public.orders set rewards_released_by = null where rewards_released_by = p_user_id;

  -- C) Customer-identity columns with no FK at all — disown, keep the row
  -- and its history (order/loyalty/review/reward/challenge data is never
  -- deleted here, only the pointer back to the now-gone identity).
  update public.reviews set user_id = null where user_id = p_user_id;
  update public.wheel_spins set user_id = null where user_id = p_user_id;
  update public.wheel_progress set user_id = null where user_id = p_user_id;
  update public.challenge_progress set user_id = null where user_id = p_user_id;
  update public.challenge_submissions set user_id = null where user_id = p_user_id;
  update public.challenge_submissions set reviewed_by = null where reviewed_by = p_user_id::text;
  update public.reward_history set user_id = null where user_id = p_user_id;
  -- loyalty_transactions.user_id is deliberately left as-is: it is the ledger
  -- itself (account_id already ties each row to the now-frozen/disowned
  -- wallet below), and every row already carries a permanent user_email
  -- snapshot regardless — nulling user_id here would remove nothing real
  -- while making "whose balance was X at time T" unanswerable for audit.

  -- Loyalty wallet: disowned AND frozen in one step, so a balance nobody can
  -- ever prove ownership of can also never be spent again. The balance and
  -- every ledger entry are untouched — no rate/earning/redemption change.
  update public.loyalty_accounts
  set user_id = null, status = 'frozen', frozen = true, updated_date = now()
  where user_id = p_user_id;

  -- D) Return/exchange credit wallet: preserved and disowned (was previously
  -- hard-deleted — see the ALTER TABLE statements above), frozen so it can
  -- never be spent by anyone claiming the same identity again.
  update public.wallets set user_id = null, status = 'frozen', updated_date = now() where user_id = p_user_id;
  update public.wallet_transactions set user_id = null where user_id = p_user_id;
end;
$$;

revoke all on function public._cleanup_user_data(uuid) from public, anon, authenticated;

-- Admin path: same authorization/audit-log behavior as before, now using the
-- shared cleanup helper instead of its own narrower inline statements.
create or replace function public.admin_delete_user_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_email text; v_orders int; v_spent numeric; v_wallet numeric;
begin
  if not is_admin() then return jsonb_build_object('success', false, 'message', 'Not authorized'); end if;
  if p_user_id = auth.uid() then return jsonb_build_object('success', false, 'message', 'Cannot delete your own account here'); end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('success', false, 'message', 'User not found'); end if;
  if v_profile.role = 'admin' then
    return jsonb_build_object('success', false, 'message', 'Demote this admin first, then use Staff & Access to remove them');
  end if;

  select count(*), coalesce(sum(total), 0) into v_orders, v_spent from public.orders where created_by_id = p_user_id and status <> 'cancelled';
  select coalesce(balance, 0) into v_wallet from public.wallets where user_id = p_user_id;
  v_email := coalesce(v_profile.email, '');

  perform public._cleanup_user_data(p_user_id);

  insert into public.audit_logs (action, actor_id, actor_email, actor_role, target_type, target_id, details)
  values ('user.deleted', coalesce(auth.uid()::text, ''), coalesce(auth.jwt() ->> 'email', ''), 'admin', 'user', p_user_id::text,
    format('%s — %s orders, ₪%s spent, ₪%s wallet balance preserved (frozen)', v_email, v_orders, v_spent, v_wallet));

  delete from auth.users where id = p_user_id;

  return jsonb_build_object('success', true, 'orders', v_orders, 'spent', v_spent, 'wallet', v_wallet);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

revoke all on function public.admin_delete_user_account(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user_account(uuid) to authenticated;

-- Self-service path: always operates on the caller's own auth.uid(), never on
-- a caller-supplied id, so a customer can only ever delete themselves. Admin
-- accounts are refused here too (they must be demoted and removed through
-- Staff & Access, exactly like the admin path already requires).
create or replace function public.self_delete_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Auth required');
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Profile not found');
  end if;
  if v_profile.role = 'admin' then
    return jsonb_build_object('success', false, 'message', 'Admin accounts cannot be self-deleted — demote first');
  end if;

  perform public._cleanup_user_data(v_uid);

  insert into public.audit_logs (action, actor_id, actor_email, actor_role, target_type, target_id, details)
  values ('user.self_deleted', v_uid::text, coalesce(v_profile.email, ''), 'user', 'user', v_uid::text,
    coalesce(v_profile.email, '') || ' — self-service account deletion');

  delete from auth.users where id = v_uid;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

revoke all on function public.self_delete_account() from public, anon;
grant execute on function public.self_delete_account() to authenticated;
