-- Converts products.gender from a combinable tag array (text[], admin chip
-- picker allowed any mix of 'Boy'/'Girl'/'Unisex') to a single canonical
-- classification value: exactly 'male' | 'female' | 'both', or NULL for
-- "not yet classified".
--
-- Verified before writing this migration: every existing product has
-- gender = '{}' (the admin editor never actually persisted a selection —
-- that was the underlying bug), so there is no real tag data to migrate.
-- Every row becomes NULL (unclassified) here, which is the correct,
-- explicitly-requested outcome for legacy/never-classified products — they
-- must NOT be silently treated as "both".
alter table public.products drop column gender;
alter table public.products add column gender text;
alter table public.products add constraint products_gender_check check (gender in ('male', 'female', 'both'));

comment on column public.products.gender is
  'Single canonical audience classification: male | female | both | NULL (unclassified). NULL is intentionally excluded from Boys-only/Girls-only storefront filters and must never be treated as "both".';
