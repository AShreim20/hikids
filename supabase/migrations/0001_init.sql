-- HiKids: Base44 -> Supabase migration, Phase 0
-- Creates all 26 entity tables (everything except Base44's `User`, which folds
-- into `profiles`), the profiles/role system, RLS helper functions, RLS
-- policies for all 5 access buckets, and foreign keys.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_date trigger (Base44 auto-maintained `updated_date` on every write)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (replaces Base44's `User` entity) + auto-provision on signup
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'user' check (role in ('admin', 'user')),
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_date();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles_read_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_permission(perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or perm = any(permissions))
  );
$$;

-- NOTE: is_admin()/has_permission() must be created before any policy below
-- references them (policies are resolved at execution time, but keep this
-- ordering for readability/self-documentation).

-- ---------------------------------------------------------------------------
-- Bucket 1: public read / admin write
-- Category, Product, Bundle, HeroSlide, Setting, SiteContent, SiteSetting,
-- WheelConfig, WheelReward, DeliveryCity, Challenge
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  name text not null,
  name_en text,
  description text,
  description_en text,
  active boolean not null default true,
  discount_percent numeric not null default 0,
  discount_active boolean not null default false,
  sort_order integer not null default 0,
  image_url text
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  name text not null,
  name_en text,
  description text,
  description_en text,
  price numeric not null,
  sale_price numeric,
  unit_cost numeric,
  barcode text,
  category text not null,
  age_range text,
  ages text[] not null default '{}',
  gender text[] not null default '{}',
  image_url text not null,
  images text[] not null default '{}',
  video_url text,
  material text,
  rating numeric,
  stock integer not null default 0,
  featured boolean not null default false,
  loyalty_exempt boolean not null default false,
  tags text[] not null default '{}',
  options jsonb not null default '[]',
  variants jsonb not null default '[]'
);

create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  name text not null,
  description text,
  image_url text,
  items jsonb not null default '[]',
  bundle_price numeric not null,
  discount_percent numeric,
  start_date date,
  end_date date,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  title text,
  subtitle text,
  description text,
  image_url text not null,
  cta_label text,
  cta_link text,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  key text not null unique,
  value numeric,
  description text
);

create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  key text not null unique,
  data jsonb not null default '{}'
);

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  key text not null unique default 'global',
  store_name text,
  logo_url text,
  phone text,
  phone_tel text,
  whatsapp text,
  email text,
  instagram text,
  facebook text,
  address_ar text,
  address_en text,
  hours_ar text,
  hours_en text
);

create table public.wheel_config (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  name text,
  min_amount numeric not null,
  basis text,
  period_start date,
  period_end date,
  start_date date,
  end_date date,
  active boolean not null default true,
  max_spins integer not null default 0,
  spins_expire boolean not null default false,
  accumulate boolean not null default false,
  first_time_enabled boolean not null default false,
  first_time_new_only boolean not null default false,
  reward_expiry_days integer not null default 0
);

create table public.wheel_rewards (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  label text not null,
  label_en text,
  type text not null,
  value numeric,
  product_id uuid,
  product_name text,
  weight numeric not null,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.delivery_cities (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  name text not null,
  price numeric not null,
  estimated_days integer,
  active boolean not null default true,
  description text
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  name text not null,
  name_en text,
  description text,
  type text not null,
  target jsonb,
  reward_type text not null,
  reward_value numeric,
  reward_label text,
  reward_label_en text,
  product_id uuid,
  reward_code_prefix text,
  start_date date,
  end_date date,
  active boolean not null default true,
  frequency text,
  limit_count integer,
  requires_review boolean not null default false,
  created_by_email text
);

-- ---------------------------------------------------------------------------
-- Bucket 2: user-scoped (email/owner match or admin)
-- LoyaltyAccount, LoyaltyTransaction, ChallengeProgress, ChallengeSubmission,
-- RewardHistory, WheelProgress, WheelSpin, Order, Address
-- ---------------------------------------------------------------------------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  label text,
  recipient_name text not null,
  phone text not null,
  city text not null,
  street text not null,
  details text,
  is_default boolean not null default false
);

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  wallet_code text unique,
  user_id uuid,
  user_email text not null,
  user_name text,
  user_phone text,
  balance integer not null default 0,
  pending_points integer not null default 0,
  lifetime_earned integer not null default 0,
  lifetime_spent integer not null default 0,
  lifetime_removed integer not null default 0,
  expired_points integer not null default 0,
  status text not null default 'active',
  frozen boolean not null default false,
  last_activity_at timestamptz,
  description text
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  account_id uuid,
  wallet_code text,
  user_id uuid,
  user_email text not null,
  points integer not null,
  type text not null,
  status text not null default 'completed',
  reason text,
  order_id uuid,
  reference_transaction_id uuid,
  balance_before integer,
  balance_after integer,
  actor_email text,
  idempotency_key text unique,
  expires_at timestamptz,
  description text
);

create table public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  challenge_id uuid,
  user_id uuid,
  user_email text not null,
  completions integer not null default 0,
  rewarded_count integer not null default 0,
  last_completed_at timestamptz,
  recipients text[] not null default '{}',
  rewarded_order_ids text[] not null default '{}',
  status text not null default 'active'
);

create table public.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  challenge_id uuid,
  challenge_name text,
  challenge_name_en text,
  user_id uuid,
  user_email text not null,
  file_url text not null,
  note text,
  status text not null default 'pending',
  reviewed_by text,
  review_note text,
  reward_granted boolean not null default false
);

create table public.reward_history (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  user_id uuid,
  user_email text not null,
  source text not null,
  source_id text,
  source_name text,
  source_name_en text,
  reward_type text not null,
  reward_label text,
  reward_label_en text,
  points integer,
  discount_code text,
  product_id uuid,
  amount numeric,
  fulfillment text
);

create table public.wheel_progress (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  user_id uuid,
  user_email text not null,
  eligible_amount numeric not null default 0,
  spins_earned integer not null default 0,
  spins_used integer not null default 0,
  free_spin_granted boolean not null default false,
  last_order_id uuid,
  last_activity_at timestamptz
);

create table public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  user_id uuid,
  user_email text not null,
  source text,
  order_id uuid,
  reward_id uuid,
  reward_type text not null,
  reward_label text,
  reward_label_en text,
  reward_value numeric,
  product_id uuid,
  product_name text,
  product_name_en text,
  product_image text,
  product_price numeric,
  points_awarded integer,
  discount_code text,
  discount_code_id uuid,
  customer_name text,
  customer_phone text,
  status text not null default 'unused',
  redeemed_order_id uuid,
  expires_at timestamptz,
  fulfillment text
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  items jsonb not null default '[]',
  total numeric,
  subtotal numeric,
  delivery_cost numeric not null default 0,
  discount_code text,
  discount_amount numeric not null default 0,
  loyalty_points integer not null default 0,
  loyalty_discount numeric not null default 0,
  loyalty_redeem_key text,
  loyalty_pending_points integer not null default 0,
  loyalty_awarded boolean not null default false,
  loyalty_reversed boolean not null default false,
  loyalty_released boolean not null default false,
  discount_counted boolean not null default false,
  stock_committed boolean not null default false,
  secured boolean not null default false,
  city text not null,
  customer_name text not null,
  customer_email text not null,
  address text not null,
  phone text not null,
  payment_method text not null check (payment_method in ('card', 'cod', 'loyalty')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded', 'failed')),
  gift_message text,
  delivery_notes text,
  internal_notes text,
  description text,
  handled_by text,
  status text not null default 'new',
  activity jsonb not null default '[]'
);

-- ---------------------------------------------------------------------------
-- Bucket 3: owner-or-admin with status gating
-- Review (photo hidden until status = 'approved')
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  product_id uuid,
  rating integer not null check (rating between 1 and 5),
  name text not null,
  comment text not null,
  photo_url text,
  status text not null default 'pending',
  user_id uuid,
  user_email text,
  reward_granted boolean not null default false,
  reviewed_by text,
  review_note text,
  description text
);

-- ---------------------------------------------------------------------------
-- Bucket 4: admin-only everything
-- AuditLog, DiscountCode, PurchaseOrder, Supplier, SupplierTransaction
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  action text not null,
  actor_id text not null,
  actor_email text,
  actor_role text,
  target_type text,
  target_id text,
  details text
);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  code text not null unique,
  description text,
  type text not null check (type in ('percent', 'fixed')),
  value numeric not null,
  min_subtotal numeric not null default 0,
  usage_limit integer,
  used_count integer not null default 0,
  expires_at date,
  active boolean not null default true,
  owner_email text,
  wheel_spin_id uuid,
  source text
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  name text not null,
  phone text,
  email text,
  address text,
  contact_person text,
  notes text
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  po_number text not null,
  purchase_date date not null,
  supplier_id uuid not null,
  supplier_name text,
  supplier_invoice_ref text,
  notes text,
  payment_method text check (payment_method in ('cash', 'card', 'bank_transfer', 'cheque')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  posted boolean not null default false,
  posted_at timestamptz,
  items jsonb not null default '[]',
  subtotal numeric,
  total numeric,
  paid_amount numeric not null default 0,
  remaining numeric,
  created_by_email text
);

create table public.supplier_transactions (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  supplier_id uuid not null,
  supplier_name text,
  type text not null check (type in ('PURCHASE', 'PAYMENT', 'REVERSAL', 'ADJUSTMENT')),
  amount numeric not null,
  po_id uuid,
  po_number text,
  reason text,
  actor_email text,
  balance_before numeric,
  balance_after numeric
);

-- ---------------------------------------------------------------------------
-- Foreign keys (added after all tables exist, nullable + ON DELETE SET NULL
-- so a deleted parent never blocks the child row -- mirrors Base44's lack of
-- enforced referential integrity while giving us real FK benefits going
-- forward: joins, cascading admin UI, data-integrity checks in later phases)
-- ---------------------------------------------------------------------------

alter table public.challenges
  add constraint challenges_product_id_fkey foreign key (product_id) references public.products(id) on delete set null;

alter table public.challenge_progress
  add constraint challenge_progress_challenge_id_fkey foreign key (challenge_id) references public.challenges(id) on delete cascade;

alter table public.challenge_submissions
  add constraint challenge_submissions_challenge_id_fkey foreign key (challenge_id) references public.challenges(id) on delete cascade;

alter table public.wheel_rewards
  add constraint wheel_rewards_product_id_fkey foreign key (product_id) references public.products(id) on delete set null;

alter table public.wheel_spins
  add constraint wheel_spins_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null,
  add constraint wheel_spins_reward_id_fkey foreign key (reward_id) references public.wheel_rewards(id) on delete set null,
  add constraint wheel_spins_product_id_fkey foreign key (product_id) references public.products(id) on delete set null,
  add constraint wheel_spins_discount_code_id_fkey foreign key (discount_code_id) references public.discount_codes(id) on delete set null,
  add constraint wheel_spins_redeemed_order_id_fkey foreign key (redeemed_order_id) references public.orders(id) on delete set null;

alter table public.wheel_progress
  add constraint wheel_progress_last_order_id_fkey foreign key (last_order_id) references public.orders(id) on delete set null;

alter table public.loyalty_transactions
  add constraint loyalty_transactions_account_id_fkey foreign key (account_id) references public.loyalty_accounts(id) on delete set null,
  add constraint loyalty_transactions_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null,
  add constraint loyalty_transactions_reference_transaction_id_fkey foreign key (reference_transaction_id) references public.loyalty_transactions(id) on delete set null;

alter table public.reward_history
  add constraint reward_history_product_id_fkey foreign key (product_id) references public.products(id) on delete set null;

alter table public.reviews
  add constraint reviews_product_id_fkey foreign key (product_id) references public.products(id) on delete cascade;

alter table public.discount_codes
  add constraint discount_codes_wheel_spin_id_fkey foreign key (wheel_spin_id) references public.wheel_spins(id) on delete set null;

alter table public.purchase_orders
  add constraint purchase_orders_supplier_id_fkey foreign key (supplier_id) references public.suppliers(id) on delete restrict;

alter table public.supplier_transactions
  add constraint supplier_transactions_supplier_id_fkey foreign key (supplier_id) references public.suppliers(id) on delete cascade,
  add constraint supplier_transactions_po_id_fkey foreign key (po_id) references public.purchase_orders(id) on delete set null;

-- ---------------------------------------------------------------------------
-- updated_date triggers on every table
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'categories', 'products', 'bundles', 'hero_slides', 'settings',
      'site_content', 'site_settings', 'wheel_config', 'wheel_rewards',
      'delivery_cities', 'challenges', 'addresses', 'loyalty_accounts',
      'loyalty_transactions', 'challenge_progress', 'challenge_submissions',
      'reward_history', 'wheel_progress', 'wheel_spins', 'orders', 'reviews',
      'audit_logs', 'discount_codes', 'suppliers', 'purchase_orders',
      'supplier_transactions'
    ])
  loop
    execute format(
      'create trigger %I_set_updated_date before update on public.%I for each row execute function public.set_updated_date();',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.bundles enable row level security;
alter table public.hero_slides enable row level security;
alter table public.settings enable row level security;
alter table public.site_content enable row level security;
alter table public.site_settings enable row level security;
alter table public.wheel_config enable row level security;
alter table public.wheel_rewards enable row level security;
alter table public.delivery_cities enable row level security;
alter table public.challenges enable row level security;
alter table public.addresses enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.challenge_submissions enable row level security;
alter table public.reward_history enable row level security;
alter table public.wheel_progress enable row level security;
alter table public.wheel_spins enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_logs enable row level security;
alter table public.discount_codes enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.supplier_transactions enable row level security;

-- Bucket 1: public read / admin write
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'categories', 'products', 'bundles', 'hero_slides', 'settings',
      'site_content', 'site_settings', 'wheel_config', 'wheel_rewards',
      'delivery_cities', 'challenges'
    ])
  loop
    execute format('create policy "%s_public_read" on public.%I for select using (true);', t, t);
    execute format('create policy "%s_admin_insert" on public.%I for insert with check (public.is_admin());', t, t);
    execute format('create policy "%s_admin_update" on public.%I for update using (public.is_admin()) with check (public.is_admin());', t, t);
    execute format('create policy "%s_admin_delete" on public.%I for delete using (public.is_admin());', t, t);
  end loop;
end;
$$;

-- Bucket 2: user-scoped (user_email match or admin) -- for read; writes are
-- service-role only (Edge Functions) except where noted below.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'loyalty_accounts', 'loyalty_transactions', 'challenge_progress',
      'challenge_submissions', 'reward_history', 'wheel_progress', 'wheel_spins'
    ])
  loop
    execute format(
      'create policy "%s_read_own_or_admin" on public.%I for select using (user_email = (auth.jwt() ->> ''email'') or public.is_admin());',
      t, t
    );
    execute format('create policy "%s_admin_all_write" on public.%I for all using (public.is_admin()) with check (public.is_admin());', t, t);
  end loop;
end;
$$;

-- Address: owned by created_by_id (not user_email), full CRUD by owner
create policy "addresses_read_own_or_admin" on public.addresses
  for select using (created_by_id = auth.uid() or public.is_admin());
create policy "addresses_insert_own" on public.addresses
  for insert with check (created_by_id = auth.uid());
create policy "addresses_update_own" on public.addresses
  for update using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());
create policy "addresses_delete_own" on public.addresses
  for delete using (created_by_id = auth.uid());

-- Order: read own (by created_by_id or customer_email) or admin. Insert is
-- allowed for the authenticated owner (Checkout.jsx creates the order
-- client-side; secureOrder/commitOrderStock correct it server-side
-- immediately after) -- see plan.md "orders insert policy" decision.
create policy "orders_read_own_or_admin" on public.orders
  for select using (
    created_by_id = auth.uid()
    or customer_email = (auth.jwt() ->> 'email')
    or public.is_admin()
  );
create policy "orders_insert_own" on public.orders
  for insert with check (created_by_id = auth.uid());
create policy "orders_admin_update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());
create policy "orders_admin_delete" on public.orders
  for delete using (public.is_admin());

-- Bucket 3: owner-or-admin with status gating (Review)
create policy "reviews_read_gated" on public.reviews
  for select using (
    photo_url is null
    or status = 'approved'
    or created_by_id = auth.uid()
    or public.is_admin()
  );
create policy "reviews_insert_authenticated" on public.reviews
  for insert with check (created_by_id = auth.uid());
create policy "reviews_update_own_or_admin" on public.reviews
  for update using (created_by_id = auth.uid() or public.is_admin())
  with check (created_by_id = auth.uid() or public.is_admin());
create policy "reviews_delete_own_or_admin" on public.reviews
  for delete using (created_by_id = auth.uid() or public.is_admin());

-- Bucket 4: admin-only everything
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'audit_logs', 'discount_codes', 'suppliers', 'purchase_orders',
      'supplier_transactions'
    ])
  loop
    execute format('create policy "%s_admin_all" on public.%I for all using (public.is_admin()) with check (public.is_admin());', t, t);
  end loop;
end;
$$;
