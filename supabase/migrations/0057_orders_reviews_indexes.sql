-- Orders/Reviews indexes (P2), added only where a concrete existing query
-- pattern justifies them. Confirmed before adding: neither table had any
-- index besides its primary key.
--
-- orders:
--  - created_by_id / customer_email: both are OR-ed together in the
--    orders_read_own_or_admin RLS policy (0001_init.sql), so EVERY non-admin
--    SELECT on orders — My Orders, OrderDetailCustomer, etc. — filters on
--    one of these two on every row.
--  - status: filtered constantly (admin status tabs, "<> 'cancelled'" checks
--    in secure_order/commit_order_stock/discount-pending counts).
--  - created_date: every admin/customer list reads '.list('-created_date', N)'
--    (a plain btree index also serves a DESC scan/ORDER BY efficiently).
--  - discount_code: _secure_order_base's pending-use count
--    (0050_discount_code_concurrency.sql) scans orders by discount_code on
--    every checkout that applies a code — currently unindexed.
create index if not exists orders_created_by_id_idx on public.orders (created_by_id);
create index if not exists orders_customer_email_idx on public.orders (customer_email);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_date_idx on public.orders (created_date);
create index if not exists orders_discount_code_idx on public.orders (discount_code) where discount_code is not null;

-- reviews:
--  - (product_id, created_date): Reviews.jsx filters by product_id and orders
--    by created_date on every storefront product page view — the single
--    highest-traffic query against this table.
--  - status: PhotoReviews.jsx (admin) filters status = 'pending'.
create index if not exists reviews_product_id_created_date_idx on public.reviews (product_id, created_date);
create index if not exists reviews_status_idx on public.reviews (status);
