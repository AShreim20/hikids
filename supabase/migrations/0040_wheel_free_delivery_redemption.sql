-- Wheel "Free Delivery" reward: redeemable at checkout.
-- The entitlement is the existing wheel_spins row (reward_type = 'free_delivery',
-- status unused/used, owned by user_id). Redemption is applied server-side in
-- secure_order (which already runs only AFTER the order row exists), the spin is
-- marked used + linked to that order atomically, and reverse_wheel_rewards
-- (already called on cancel/return) restores it.

alter table public.orders
  add column if not exists free_delivery_spin_id uuid references public.wheel_spins(id) on delete set null;

-- Redeemable automatically: no manual store fulfilment needed any more.
create or replace function public.wheel_spins_free_delivery_auto()
returns trigger language plpgsql as $$
begin
  if new.reward_type = 'free_delivery' then new.fulfillment := 'auto'; end if;
  return new;
end;
$$;
drop trigger if exists wheel_spins_free_delivery_auto on public.wheel_spins;
create trigger wheel_spins_free_delivery_auto before insert on public.wheel_spins
  for each row execute function public.wheel_spins_free_delivery_auto();
update public.wheel_spins set fulfillment = 'auto' where reward_type = 'free_delivery' and status = 'unused';

-- secure_order: apply a selected Free Delivery reward after the base pricing.
alter function public.secure_order(uuid) rename to _secure_order_base;
revoke execute on function public._secure_order_base(uuid) from public, anon, authenticated;

create or replace function public.secure_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_was_secured boolean; v_spin_id uuid; v_res jsonb; v_o public.orders; v_spin public.wheel_spins;
begin
  select secured, free_delivery_spin_id into v_was_secured, v_spin_id from public.orders where id = p_order_id;
  v_res := public._secure_order_base(p_order_id);
  if not coalesce((v_res->>'success')::boolean, false) or coalesce(v_was_secured, false) or v_spin_id is null then
    return v_res;
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  select * into v_spin from public.wheel_spins where id = v_spin_id for update;
  if v_o.created_by_id is not null and found
     and v_spin.user_id = v_o.created_by_id
     and v_spin.reward_type = 'free_delivery' and v_spin.status = 'unused'
     and (v_spin.expires_at is null or v_spin.expires_at >= now())
     and coalesce(v_o.delivery_cost, 0) > 0 then
    update public.wheel_spins set status = 'used', redeemed_order_id = p_order_id, updated_date = now() where id = v_spin_id;
    update public.orders set
      delivery_cost = 0,
      total = greatest(0, round(coalesce(subtotal, 0) - coalesce(discount_amount, 0) - coalesce(loyalty_discount, 0), 2)),
      updated_date = now()
    where id = p_order_id returning * into v_o;
  else
    update public.orders set free_delivery_spin_id = null, updated_date = now() where id = p_order_id returning * into v_o;
  end if;
  return jsonb_build_object('success', true, 'order', to_jsonb(v_o));
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;
revoke execute on function public.secure_order(uuid) from public;
grant execute on function public.secure_order(uuid) to authenticated, anon;

-- reverse_wheel_rewards: also restore a redeemed Free Delivery reward.
alter function public.reverse_wheel_rewards(uuid) rename to _reverse_wheel_rewards_base;
revoke execute on function public._reverse_wheel_rewards_base(uuid) from public, anon, authenticated;

create or replace function public.reverse_wheel_rewards(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb; v_n int;
begin
  v_res := public._reverse_wheel_rewards_base(p_order_id);
  if not coalesce((v_res->>'success')::boolean, false) then return v_res; end if;
  update public.wheel_spins set
    status = case when expires_at is not null and expires_at < now() then 'expired' else 'unused' end,
    redeemed_order_id = null, updated_date = now()
  where reward_type = 'free_delivery' and status = 'used' and redeemed_order_id = p_order_id;
  get diagnostics v_n = row_count;
  return jsonb_set(v_res, '{reverted}', to_jsonb(coalesce((v_res->>'reverted')::int, 0) + v_n));
end;
$$;
revoke execute on function public.reverse_wheel_rewards(uuid) from public, anon;
grant execute on function public.reverse_wheel_rewards(uuid) to authenticated;
