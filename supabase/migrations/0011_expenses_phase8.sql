-- Phase 8: operating expenses.
--
-- Until now the P&L had no opex input at all — src/lib/reports.js hardcoded
-- `const expenses = 0`. This adds the two tables behind a real Expense
-- Management page so Net Profit reflects rent, salaries, marketing etc.
--
-- Accounting boundary, deliberately enforced by keeping these tables separate
-- from purchase_orders: supplier purchases are inventory and already reach the
-- P&L through COGS (products.unit_cost). Rows here are operating expenses and
-- must only ever affect Net Profit, never Gross Profit.
--
-- Categories are rows, not an enum/check constraint, because the admin has to
-- be able to add, rename, deactivate and delete their own expense types.

create sequence if not exists public.expense_ref_seq;

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  name text not null,
  name_en text,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  -- Human-readable reference (EXP-000001), same idea as loyalty wallet_code.
  reference text not null unique
    default ('EXP-' || lpad(nextval('public.expense_ref_seq')::text, 6, '0')),
  expense_date date not null,
  category_id uuid,
  -- The spec requires rejecting zero and negative amounts. Enforced here so a
  -- bypassed client (or a direct API call) still can't write a bad row.
  amount numeric not null check (amount > 0),
  -- Same vocabulary as purchase_orders.payment_method / src/lib/po.js.
  payment_method text check (payment_method in ('cash', 'card', 'bank_transfer', 'cheque')),
  description text,
  notes text
);

-- Detach rather than cascade: deleting a category must never destroy expense
-- history (the UI additionally warns before deleting one that is still in use).
alter table public.expenses
  add constraint expenses_category_id_fkey foreign key (category_id)
  references public.expense_categories(id) on delete set null;

create index expenses_expense_date_idx on public.expenses (expense_date desc);
create index expenses_category_id_idx on public.expenses (category_id);

-- Migration 0002 only looped over the tables that existed at that time, so new
-- tables have to install both triggers explicitly.
create trigger expense_categories_set_updated_date
  before update on public.expense_categories
  for each row execute function public.set_updated_date();
create trigger expense_categories_set_created_by_id
  before insert on public.expense_categories
  for each row execute function public.set_created_by_id();

create trigger expenses_set_updated_date
  before update on public.expenses
  for each row execute function public.set_updated_date();
create trigger expenses_set_created_by_id
  before insert on public.expenses
  for each row execute function public.set_created_by_id();

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

-- Permission-gated rather than plain is_admin(): has_permission() already
-- returns true for any admin, so this also lets an owner delegate bookkeeping
-- to staff without granting full admin. Customers match neither policy and so
-- read zero rows — the access rule lives in the database, not just in the UI.
create policy "expense_categories_read" on public.expense_categories
  for select using (public.has_permission('expenses.view'));
create policy "expense_categories_write" on public.expense_categories
  for all using (public.has_permission('expenses.manage'))
  with check (public.has_permission('expenses.manage'));

create policy "expenses_read" on public.expenses
  for select using (public.has_permission('expenses.view'));
create policy "expenses_write" on public.expenses
  for all using (public.has_permission('expenses.manage'))
  with check (public.has_permission('expenses.manage'));

-- Starter categories. These are ordinary rows: rename, deactivate or delete
-- them freely, and add your own.
insert into public.expense_categories (name, name_en, sort_order) values
  ('الإيجار', 'Rent', 10),
  ('الرواتب', 'Salaries', 20),
  ('الكهرباء', 'Electricity', 30),
  ('المياه', 'Water', 40),
  ('الإنترنت', 'Internet', 50),
  ('المواصلات', 'Transportation', 60),
  ('التسويق', 'Marketing', 70),
  ('الإعلانات', 'Advertising', 80),
  ('التغليف', 'Packaging', 90),
  ('التوصيل', 'Delivery', 100),
  ('الصيانة', 'Maintenance', 110),
  ('مصاريف المكتب', 'Office Expenses', 120),
  ('أخرى', 'Other', 130);
