-- Server-side rate limiting for the public chatAssistant Edge Function.
--
-- Fixed-window counters, one row per (scope:id:window) bucket. The increment is a
-- single atomic INSERT ... ON CONFLICT DO UPDATE, so concurrent requests can never
-- under-count. Only the service role (the Edge Function) may call it; the table has
-- RLS enabled with no policies, so clients cannot read or write it directly.

create table if not exists public.assistant_rate_limits (
  bucket text primary key,
  count integer not null default 0,
  expires_at timestamptz not null
);
alter table public.assistant_rate_limits enable row level security;

create index if not exists assistant_rate_limits_expires_idx
  on public.assistant_rate_limits (expires_at);

-- Returns { allowed, count, limit, retry_after } and records the attempt.
create or replace function public.assistant_rate_check(
  p_scope text,
  p_id text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_epoch bigint := extract(epoch from now())::bigint;
  v_window_start bigint := (v_epoch / p_window_seconds) * p_window_seconds;
  v_bucket text := p_scope || ':' || p_id || ':' || v_window_start;
  v_count integer;
  v_retry integer := (v_window_start + p_window_seconds - v_epoch)::integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.assistant_rate_limits as r (bucket, count, expires_at)
  values (v_bucket, 1, to_timestamp(v_window_start + p_window_seconds + 60))
  on conflict (bucket) do update set count = r.count + 1
  returning r.count into v_count;

  -- Opportunistic cleanup of expired buckets (keeps the table tiny).
  if random() < 0.02 then
    delete from public.assistant_rate_limits where expires_at < now();
  end if;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'retry_after', v_retry
  );
end;
$$;

revoke all on function public.assistant_rate_check(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.assistant_rate_check(text, text, integer, integer) to service_role;
