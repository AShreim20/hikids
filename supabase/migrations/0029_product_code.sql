-- Adds a permanent, unique, stable "Product Code" business identifier to
-- products (distinct from barcode/SKU/row id) — the primary reference for
-- Excel export/import and any future integration.
--
-- Generation must be race-safe under concurrent admins creating products at
-- the same time, so a client-side `max(existingCodes) + 1` is not
-- acceptable — a Postgres SEQUENCE is the standard, race-safe primitive for
-- exactly this (nextval() is atomic).
create sequence if not exists public.product_code_seq start 1;

alter table public.products add column if not exists product_code text;

-- Auto-generates 'HK-000001' style codes for a new product that didn't
-- specify one; trims (never silently accepts) a manually-typed one. Only
-- fires on INSERT — an existing product's code is never touched by this,
-- which is what keeps it stable across every later edit (name/barcode/
-- price/stock/category/status changes never regenerate it).
create or replace function public.set_product_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_code is null or btrim(new.product_code) = '' then
    new.product_code := 'HK-' || lpad(nextval('public.product_code_seq')::text, 6, '0');
  else
    new.product_code := btrim(new.product_code);
  end if;
  return new;
end;
$$;

drop trigger if exists products_set_product_code on public.products;
create trigger products_set_product_code
  before insert on public.products
  for each row
  execute function public.set_product_code();

-- Backfill every existing product that has no code yet, drawing from the
-- same sequence future auto-generated codes will use (so numbering is
-- continuous, not restarted). Temporarily disable the updated_date trigger
-- for this one statement — this is a metadata backfill, not a real content
-- edit, and several storefront sections (Homepage Deals, Recommendations,
-- Similar Products) key off `updated_date` recency, which must not shift
-- for every product just because this migration ran.
alter table public.products disable trigger products_set_updated_date;

update public.products
set product_code = 'HK-' || lpad(nextval('public.product_code_seq')::text, 6, '0')
where product_code is null or btrim(product_code) = '';

alter table public.products enable trigger products_set_updated_date;

-- Now that every row has a code, make it mandatory and enforce uniqueness
-- at the database level (case-insensitive — a human-typed business code
-- like "sup-100" and "SUP-100" should not be treated as two different
-- codes, while the originally-typed casing is still preserved for display).
alter table public.products alter column product_code set not null;

create unique index if not exists products_product_code_lower_idx
  on public.products (lower(product_code));
