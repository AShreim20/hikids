-- Checkout: email is now optional (phone remains the required primary
-- contact method for delivery). customer_email was `not null` since the
-- original schema -- allow null instead of forcing a fake/placeholder
-- value. Every other required delivery field (customer_name, address,
-- phone, city) is untouched.
alter table public.orders alter column customer_email drop not null;
