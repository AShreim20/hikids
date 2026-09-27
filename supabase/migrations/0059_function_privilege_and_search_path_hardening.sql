-- P3 security pass: function privileges + search_path hardening.
--
-- Full inventory of every SECURITY DEFINER function currently exposed to
-- anon/authenticated (100 findings from the Supabase security advisor) was
-- reviewed function-by-function. The large majority — every admin_*,
-- customer_*, challenges_*, wheel_*, loyalty/wallet, redeem_discount,
-- submit_return_request, secure_order, commit_order_stock,
-- admin_delete_user_account, self_delete_account, is_admin(), has_permission()
-- — already has its own internal auth.uid()/is_admin()/has_permission()/
-- ownership check (verified individually; several were read in full during
-- this same audit) and is genuinely meant to be callable this way — that is
-- this codebase's established pattern for anything RLS alone can't express
-- (multi-step writes, guest-checkout ownership windows, etc.). None of those
-- are touched here.
--
-- The real, unnecessary exposure was 8 pure TRIGGER functions — never called
-- directly by any frontend/edge-function code, only fired automatically by
-- Postgres on INSERT/UPDATE — that were nonetheless directly callable via
-- PostgREST (e.g. POST /rest/v1/rpc/prevent_profile_privilege_escalation).
-- Revoking direct EXECUTE does not affect trigger firing: Postgres invokes a
-- trigger under its own definition regardless of the querying role's EXECUTE
-- grant on the function itself.
revoke execute on function public.orders_rewards_insert_guard() from public, anon, authenticated;
revoke execute on function public.orders_rewards_set_release_at() from public, anon, authenticated;
revoke execute on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;
revoke execute on function public.set_product_code() from public, anon, authenticated;
revoke execute on function public.trg_reconcile_rewards_from_request() from public, anon, authenticated;
revoke execute on function public.trg_reconcile_rewards_from_settlement() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
revoke execute on function public.wheel_spins_free_delivery_auto() from public, anon, authenticated;

-- search_path hardening for the 2 functions the advisor flagged as missing
-- one. Neither is SECURITY DEFINER and neither references an ambiguous
-- unqualified object, so this changes nothing about their behavior — it
-- only pins name resolution the same explicit way every other function in
-- this schema already does.
create or replace function public._variant_index(p_variants jsonb, p_key text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select (elem.ord - 1)::int
  from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb)) with ordinality as elem(value, ord)
  where elem.value->>'key' = p_key
  limit 1;
$$;

create or replace function public.wheel_spins_free_delivery_auto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.reward_type = 'free_delivery' then new.fulfillment := 'auto'; end if;
  return new;
end;
$$;
