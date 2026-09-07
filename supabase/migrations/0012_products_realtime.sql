-- Enables Supabase Realtime broadcasts for the products table, reusing the
-- exact mechanism already relied on for orders/site_content/site_settings
-- (see 0008_orders_phase5.sql). Needed so a customer viewing a product's
-- detail page can receive a live price/discount/stock update the moment an
-- admin saves it, without polling and without a full page reload.
--
-- RLS still applies to realtime the same as to reads — products are publicly
-- readable, so this does not expose anything not already public.
alter publication supabase_realtime add table public.products;
