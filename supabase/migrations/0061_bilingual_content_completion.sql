-- Bilingual content audit follow-up: adds the missing English counterpart
-- columns for customer-facing fields that were Arabic-only, following the
-- project's existing convention (base column = Arabic, `_en` = optional
-- English, fallback-to-Arabic when empty — see src/lib/bilingual.js).
--
-- Every column here is nullable/optional text, added additively. No existing
-- data is touched, converted, or backfilled — the admin fills these in
-- deliberately later (see the audit's "missing content" report).
--
-- Columns deliberately NOT added (verified non-customer-facing or unused,
-- so adding an _en twin would be inventing a need that doesn't exist today):
--   hero_slides.description   — dead column, never read by any renderer
--                                (HeroSlideContent/HeroSlideTextCompact only
--                                use title/subtitle/cta_label/secondary_cta_label).
--   delivery_cities.description — no admin UI field, no public renderer reads it.
--   discount_codes.description  — only ever rendered inside DiscountManagement
--                                  (admin's own list), never shown to a customer.
--   wheel_config.name           — internal admin label for a campaign record,
--                                  never rendered on a customer-facing page.
--   wheel_rewards.product_name  — denormalized reference set from the picked
--                                  product; the customer-facing text is
--                                  wheel_rewards.label/label_en, already bilingual.

-- Hero slides: every customer-facing text field was Arabic-only.
alter table public.hero_slides
  add column if not exists title_en text,
  add column if not exists subtitle_en text,
  add column if not exists cta_label_en text,
  add column if not exists secondary_cta_label_en text;

-- Bundles: name/description shown on Bundles / BundleDetail pages.
alter table public.bundles
  add column if not exists name_en text,
  add column if not exists description_en text;

-- Challenges: name_en/reward_label_en already existed; description did not.
alter table public.challenges
  add column if not exists description_en text;

-- Delivery cities: name is shown directly to customers at checkout
-- (Checkout.jsx renders selectedCity.name with no language branching today).
alter table public.delivery_cities
  add column if not exists name_en text;

-- Products: material is shown on the product detail page (ProductDetail.jsx
-- materialText), single-language only until now.
alter table public.products
  add column if not exists material_en text;
