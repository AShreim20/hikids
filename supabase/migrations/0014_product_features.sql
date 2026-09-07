-- Adds a structured, bilingual "Features"/"المميزات" list to products —
-- separate from the free-text description. Arrays already are the
-- established pattern on this table for list-shaped fields (tags, images,
-- ages), so this follows the same convention rather than a new format.
-- Both are optional and default to an empty array so every existing product
-- keeps working unchanged (features_ar/features_en simply read back as []).
alter table public.products
  add column features_ar text[] not null default '{}',
  add column features_en text[] not null default '{}';

comment on column public.products.features_ar is 'Ordered list of short Arabic feature/highlight phrases, separate from description. Empty/whitespace items are stripped before save.';
comment on column public.products.features_en is 'Ordered list of short English feature/highlight phrases, separate from description_en. Optional — falls back to features_ar for display when empty, same rule as description_en.';
