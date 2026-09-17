-- Returns & Exchanges — Phase 1: foundation only.
--
-- Adds the domain/database foundation for Return Requests and configurable
-- Return Reasons. This migration does NOT implement the customer submission
-- flow, admin approval workflow, inventory movements, refunds, or loyalty/
-- wheel adjustments — those are later, separately-reviewed phases. Nothing
-- here changes stock, payments, order totals, sales history, loyalty
-- balances, spins, or rewards, and no existing table is altered.
--
-- Reused from existing architecture (no duplicate models):
--   - Customer/user  -> auth.users / public.profiles (created_by_id, same
--     convention as every other table — see set_created_by_id() below).
--   - Order          -> public.orders (referenced by id, never copied).
--   - Order Item     -> orders.items is a jsonb array (there is no
--     order_items table in this schema) — a specific line is referenced by
--     (order_id, order_item_index), which is stable because order line
--     items are never rewritten/reordered after creation (see orderStatus.js
--     comments / Checkout.jsx). Historical name/price/qty are snapshotted
--     onto return_request_items at request-creation time (Phase 2) so a
--     return's values can never drift if the product record itself changes
--     later — the same "authoritative historical source" principle already
--     used by orders.items storing its own name/price instead of joining
--     products live.
--   - Product        -> public.products (product_id is a denormalized
--     convenience FK, nullable on delete, exactly like
--     challenges.product_id / wheel_rewards.product_id).
--   - Permissions     -> public.has_permission()/is_admin(), reusing the
--     already-defined 'returns.manage' permission (permissionsCore.js) —
--     no new permission invented.
--   - Code generation -> a dedicated sequence + unique column default,
--     same race-safe pattern as expenses.reference (0011_expenses_phase8.sql)
--     — nextval() is atomic, so this is safe under concurrent inserts and
--     never relies on client-side max()+1.
--   - Row-level audit -> return_requests.activity jsonb mirrors
--     orders.activity (append-only event log via logEntry()/appendActivity()
--     in orderStatus.js) — Phase 2/3 will append SUBMITTED/STATUS_CHANGED/
--     APPROVED/REJECTED/etc. entries the same way orders already do.
--
-- All enum-like text columns below use lowercase snake_case values to match
-- every existing status/type column in this schema (orders.status,
-- purchase_orders.status, wheel_spins.status, reviews.status, etc. are all
-- lowercase) even though the spec's own examples were written in CAPS.

create sequence if not exists public.return_request_code_seq;

-- ---------------------------------------------------------------------------
-- return_reasons — admin-configured policy, not hard-coded in frontend code.
-- No separate business "code" is invented for reasons: like categories and
-- expense_categories (its closest existing analogs), there are only a
-- handful of rows and `id` (uuid) is already a perfectly stable FK target —
-- inventing a public code here would violate "don't invent unnecessary
-- codes" from the site-wide Excel work.
-- ---------------------------------------------------------------------------
create table public.return_reasons (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  name text not null,
  name_en text,
  description text,
  description_en text,

  -- Allowed Actions (section 10) — a reason is never forced to support
  -- every request type; "at least one" is enforced below so a reason can
  -- never be saved in a state where a customer could select it but do
  -- nothing with it.
  allow_return boolean not null default true,
  allow_exchange boolean not null default false,
  allow_missing_item boolean not null default false,
  allow_missing_part boolean not null default false,
  check (allow_return or allow_exchange or allow_missing_item or allow_missing_part),

  -- Delivery Responsibility (section 11) — policy only, charges nothing.
  delivery_responsibility text not null default 'manual_review'
    check (delivery_responsibility in ('hikids', 'customer', 'manual_review')),

  -- Evidence Requirements (section 12).
  evidence_required boolean not null default false,
  evidence_min_images integer not null default 0 check (evidence_min_images >= 0),
  evidence_max_images integer not null default 5
    check (evidence_max_images >= evidence_min_images and evidence_max_images <= 10),
  evidence_instructions text,
  evidence_instructions_en text,

  active boolean not null default true,
  sort_order integer not null default 0
);

create index return_reasons_active_sort_idx on public.return_reasons (active, sort_order);

-- ---------------------------------------------------------------------------
-- return_requests — one per customer return/exchange request against a
-- single existing order. Workflow states only in Phase 1: no status change
-- here triggers stock, refund, loyalty, or spin changes.
-- ---------------------------------------------------------------------------
create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  -- Stable, backend-generated, race-safe (nextval() is atomic), never
  -- reused, never changes after creation. Business/display reference only —
  -- never treated as a security/access credential (see RLS notes below).
  request_code text not null unique
    default ('RET-' || lpad(nextval('public.return_request_code_seq')::text, 6, '0')),

  order_id uuid not null references public.orders(id) on delete restrict,

  request_type text not null check (request_type in ('return', 'exchange')),

  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'under_review', 'needs_information',
    'approved', 'rejected', 'awaiting_return', 'received',
    'processing', 'completed', 'cancelled'
  )),

  customer_note text,
  admin_note text,

  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  rejection_reason text,

  -- Append-only workflow event log, same shape/idea as orders.activity —
  -- Phase 2/3 append {at, action, from, to, by, note} entries here (e.g.
  -- SUBMITTED, STATUS_CHANGED, APPROVED, REJECTED, RECEIVED,
  -- INVENTORY_PROCESSED, REFUND_PROCESSED, EXCHANGE_COMPLETED). Nothing
  -- populates this in Phase 1.
  activity jsonb not null default '[]'
);

create index return_requests_order_id_idx on public.return_requests (order_id);
create index return_requests_created_by_id_idx on public.return_requests (created_by_id);
create index return_requests_status_idx on public.return_requests (status);

-- ---------------------------------------------------------------------------
-- return_request_items — one or more original-order lines included in a
-- Return Request. The Original Order Item (a specific entry inside the
-- parent order's `items` jsonb array) is the authoritative historical
-- source for name/price/quantity — never the live Product row.
-- ---------------------------------------------------------------------------
create table public.return_request_items (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  return_request_id uuid not null references public.return_requests(id) on delete cascade,

  -- Denormalized from the parent request (same order_id) purely so the
  -- future "already returned how much of this line, across every request
  -- over time" lookback query (section 8) can filter this table alone —
  -- same convenience denormalization already used by
  -- wheel_spins.order_id/loyalty_transactions.order_id.
  order_id uuid not null references public.orders(id) on delete restrict,
  -- Position of the line inside orders.items[] — stable because order line
  -- items are never rewritten/reordered/deleted after creation (see file
  -- header). There is no order_items table to hold a real foreign key to.
  order_item_index integer not null check (order_item_index >= 0),

  -- Denormalized convenience FK (nullable — a deleted product must never
  -- block a historical return record), never the source of truth for
  -- name/price below.
  product_id uuid references public.products(id) on delete set null,

  -- Snapshot of the original order item at the time this return item was
  -- created — authoritative, never re-derived from the current Product row.
  product_name text,
  product_name_en text,
  sku text,
  unit_price numeric,
  purchased_quantity integer not null check (purchased_quantity > 0),

  requested_quantity integer not null check (requested_quantity > 0),

  reason_id uuid references public.return_reasons(id) on delete restrict,
  -- Snapshot of the reason's policy fields as they existed when this item's
  -- request was submitted (section 16) — so editing a Return Reason's
  -- delivery/evidence policy tomorrow never silently rewrites what applied
  -- to an already-submitted request. Populated by Phase 2 at submission
  -- time; unused (null) for anything created in Phase 1.
  reason_policy_snapshot jsonb,

  customer_explanation text,

  -- Extensible resolution classification (section 5) — a plain
  -- classification column, no workflow branches on it yet.
  resolution_type text check (
    resolution_type is null or resolution_type in
    ('missing_item', 'missing_part', 'wrong_item', 'damaged_item')
  ),

  -- Future physical-inspection classification (section 20) — added now so
  -- Phase 3 doesn't need a schema change, never written to in Phase 1.
  condition_on_inspection text check (
    condition_on_inspection is null or condition_on_inspection in
    ('sellable', 'damaged', 'incomplete', 'needs_inspection')
  ),

  admin_note text
);

create index return_request_items_return_request_id_idx on public.return_request_items (return_request_id);
create index return_request_items_reason_id_idx on public.return_request_items (reason_id);
-- Powers the future "how much of this order line has already been
-- requested/returned across every request over time" validation (section 8).
create index return_request_items_order_lookback_idx on public.return_request_items (order_id, order_item_index);

-- ---------------------------------------------------------------------------
-- updated_date / created_by_id triggers (0002/0001's generic loops only ran
-- once, over the tables that existed at that time).
-- ---------------------------------------------------------------------------
create trigger return_reasons_set_updated_date
  before update on public.return_reasons
  for each row execute function public.set_updated_date();
create trigger return_reasons_set_created_by_id
  before insert on public.return_reasons
  for each row execute function public.set_created_by_id();

create trigger return_requests_set_updated_date
  before update on public.return_requests
  for each row execute function public.set_updated_date();
create trigger return_requests_set_created_by_id
  before insert on public.return_requests
  for each row execute function public.set_created_by_id();

create trigger return_request_items_set_updated_date
  before update on public.return_request_items
  for each row execute function public.set_updated_date();
create trigger return_request_items_set_created_by_id
  before insert on public.return_request_items
  for each row execute function public.set_created_by_id();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.return_reasons enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_request_items enable row level security;

-- return_reasons: Bucket-1-style (public read / permission-gated write) —
-- same shape as categories/delivery_cities, since a reason's name/policy is
-- non-sensitive merchandising config a customer must be able to see when
-- Phase 2 builds the request form, permission-gated (not plain is_admin())
-- like expenses.manage so an owner can delegate returns handling to staff.
create policy "return_reasons_public_read" on public.return_reasons
  for select using (true);
create policy "return_reasons_write" on public.return_reasons
  for all using (public.has_permission('returns.manage'))
  with check (public.has_permission('returns.manage'));

-- return_requests / return_request_items: permission-gated only, for BOTH
-- read and write, in Phase 1 — there is no customer-facing submission flow
-- yet, so no customer-scoped policy is added until Phase 2 needs one.
--
-- Phase 2 must add, at minimum:
--   - a customer read-own policy (created_by_id = auth.uid(), mirroring
--     orders_read_own_or_admin) — never let a request be looked up by its
--     RET-###### code alone, since the code is a display reference, not an
--     access credential (section 25).
--   - a controlled insert path (an Edge Function/RPC that validates the
--     caller owns order_id and enforces the quantity rules from section 8,
--     mirroring how Checkout.jsx's client insert is immediately corrected/
--     verified server-side by secureOrder) rather than an open
--     "insert own row" RLS policy, since a raw client insert can't
--     validate cross-table quantity limits.
create policy "return_requests_manage" on public.return_requests
  for all using (public.has_permission('returns.manage'))
  with check (public.has_permission('returns.manage'));
create policy "return_request_items_manage" on public.return_request_items
  for all using (public.has_permission('returns.manage'))
  with check (public.has_permission('returns.manage'));
