-- Multi-category support for products: one Primary Category + zero or more
-- Additional Categories, both referencing the existing `categories` table by
-- stable id (never by translated name).
--
-- The legacy `products.category` (text, category NAME) column is kept as-is
-- and becomes a denormalized mirror of the primary category's name — every
-- existing read path (product cards, ProductDetail, search, category
-- discount lookup by name, admin list, etc.) keeps working completely
-- unchanged. Only the paths that need real multi-category awareness
-- (category filtering, Similar Products, the admin editor) are updated
-- separately to also read primary_category_id/category_ids.

alter table public.products
  add column primary_category_id uuid references public.categories(id) on delete set null,
  add column category_ids uuid[] not null default '{}';

-- Backfill: every existing product's current (single) category becomes its
-- Primary Category, with no Additional Categories — exactly the "no manual
-- editing required, nothing disappears" migration the task calls for.
update public.products p
set primary_category_id = c.id
from public.categories c
where p.category = c.name
  and p.primary_category_id is null;

-- A handful of legacy rows may have a `category` value that no longer
-- matches any current category name (renamed/removed category). Leave
-- primary_category_id null there rather than guessing — the text `category`
-- column still carries the original label everywhere that reads it, so
-- nothing about the product's current display or filtering breaks.

create index products_category_ids_gin on public.products using gin (category_ids);
create index products_primary_category_id_idx on public.products (primary_category_id);
