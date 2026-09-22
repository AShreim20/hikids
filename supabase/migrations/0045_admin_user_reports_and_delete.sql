-- User Management: a per-user quick report (orders/total spent, loyalty
-- points, wallet balance, last activity) and an admin-only delete action.
--
-- Deleting a customer's login must not silently destroy financial/audit
-- records: most created_by_id/user_id FKs to auth.users already resolve to
-- NULL on delete (orders, loyalty_accounts, loyalty_transactions, reviews,
-- wheel_*, reward_history, addresses, customer_inquiries) -- confirmed via
-- pg_constraint before writing this. The only ones that are NOT nullable
-- (and would otherwise block the delete) are wallets/wallet_transactions
-- (NOT NULL user_id) and a couple of nullable-but-still-RESTRICT return
-- columns; both are handled explicitly below before the actual delete.

create or replace function public.admin_user_reports()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'total_orders', coalesce(o.cnt, 0),
      'total_spent', coalesce(o.total, 0),
      'points_balance', coalesce(la.balance, 0),
      'wallet_balance', coalesce(w.balance, 0),
      'last_activity_at', greatest(o.last_at, lt.last_at, wt.last_at),
      'last_activity_type', case greatest(o.last_at, lt.last_at, wt.last_at)
        when o.last_at then 'order' when lt.last_at then 'loyalty' when wt.last_at then 'wallet' else null end
    ))
    from auth.users u
    left join (
      select created_by_id, count(*) cnt, sum(total) total, max(created_date) last_at
      from public.orders where status <> 'cancelled' group by created_by_id
    ) o on o.created_by_id = u.id
    left join public.loyalty_accounts la on la.user_id = u.id
    left join public.wallets w on w.user_id = u.id
    left join (select user_id, max(created_date) last_at from public.loyalty_transactions group by user_id) lt on lt.user_id = u.id
    left join (select user_id, max(created_date) last_at from public.wallet_transactions group by user_id) wt on wt.user_id = u.id
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.admin_user_reports() from public, anon, authenticated;
grant execute on function public.admin_user_reports() to authenticated;

create or replace function public.admin_delete_user_account(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_email text; v_orders int; v_spent numeric; v_wallet numeric;
begin
  if not is_admin() then return jsonb_build_object('success', false, 'message', 'Not authorized'); end if;
  if p_user_id = auth.uid() then return jsonb_build_object('success', false, 'message', 'Cannot delete your own account here'); end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('success', false, 'message', 'User not found'); end if;
  -- Staff/owner accounts are managed via role changes (Promote/Demote) and
  -- Staff & Access, never deleted from this button.
  if v_profile.role = 'admin' then
    return jsonb_build_object('success', false, 'message', 'Demote this admin first, then use Staff & Access to remove them');
  end if;

  select count(*), coalesce(sum(total), 0) into v_orders, v_spent from public.orders where created_by_id = p_user_id and status <> 'cancelled';
  select coalesce(balance, 0) into v_wallet from public.wallets where user_id = p_user_id;
  v_email := coalesce(v_profile.email, '');

  -- Not-null / RESTRICT columns that ON DELETE CASCADE/SET NULL doesn't
  -- already cover -- anonymize (return records) or remove (the wallet ledger
  -- itself, which cannot outlive its own not-null owner column).
  update public.return_requests set created_by_id = null where created_by_id = p_user_id;
  update public.return_request_items set created_by_id = null where created_by_id = p_user_id;
  update public.return_request_notes set created_by_id = null where created_by_id = p_user_id;
  delete from public.wallet_transactions where user_id = p_user_id;
  delete from public.wallets where user_id = p_user_id;

  insert into public.audit_logs (action, actor_id, actor_email, actor_role, target_type, target_id, details)
  values ('user.deleted', coalesce(auth.uid()::text, ''), coalesce(auth.jwt() ->> 'email', ''), 'admin', 'user', p_user_id::text,
    format('%s — %s orders, ₪%s spent, ₪%s wallet balance removed', v_email, v_orders, v_spent, v_wallet));

  -- Deletes auth.users; profiles cascades, and every other reference
  -- (orders, loyalty_accounts, loyalty_transactions, reviews, wheel_*,
  -- reward_history, addresses, customer_inquiries) resolves to NULL —
  -- confirmed via pg_constraint, not assumed.
  delete from auth.users where id = p_user_id;

  return jsonb_build_object('success', true, 'orders', v_orders, 'spent', v_spent, 'wallet', v_wallet);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.admin_delete_user_account(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user_account(uuid) to authenticated;
