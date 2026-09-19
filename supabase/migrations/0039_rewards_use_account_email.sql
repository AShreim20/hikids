-- Loyalty wallets are keyed by the customer's registration (auth) email, never
-- the order's optional contact email (which may be empty).
create or replace function public._order_owner_email(p_user_id uuid, p_order_email text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select email from auth.users where id = p_user_id), p_order_email);
$$;
revoke execute on function public._order_owner_email(uuid, text) from public, anon, authenticated;

do $$
declare f text; def text;
begin
  foreach f in array array[
    'public._award_loyalty_points_legacy(uuid)', 'public.award_loyalty_points(uuid)',
    'public._release_order_rewards(uuid,text,boolean,uuid)', 'public._reconcile_order_rewards(uuid)']
  loop
    def := pg_get_functiondef(f::regprocedure);
    def := replace(def, 'p_user_email => v_order.customer_email', 'p_user_email => public._order_owner_email(v_order.created_by_id, v_order.customer_email)');
    def := replace(def, 'compute_wheel_state(v_order.created_by_id, v_order.customer_email)', 'compute_wheel_state(v_order.created_by_id, public._order_owner_email(v_order.created_by_id, v_order.customer_email))');
    execute def;
  end loop;
end $$;
