-- Homepage Stage 5: Newsletter / offers subscription. No such system
-- existed before this migration — the old Newsletter.jsx form was
-- frontend-only (setState + a fake "sent" flag, nothing persisted).
--
-- Guest signup, email and/or phone only (no other personal info collected).
-- Mirrors the guest-order pattern already used for `orders`: public can
-- INSERT, nobody (anon or authenticated) can SELECT/UPDATE/DELETE — the
-- client always calls db.NewsletterSubscriber.create(payload, { returning:
-- false }), same as a guest checkout. The store owner queries the list
-- directly (Supabase dashboard/SQL) — no in-app subscriber list is part of
-- this task.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  email text,
  phone text,
  constraint newsletter_subscribers_contact_chk check (email is not null or phone is not null)
);

-- Case-insensitive uniqueness on email; exact-match uniqueness on phone
-- (phone is normalized to "+<dial> <digits>" client-side before insert, the
-- same shape Checkout already builds via CountryCodeSelect/dialFor).
create unique index newsletter_subscribers_email_uq on public.newsletter_subscribers (lower(email)) where email is not null;
create unique index newsletter_subscribers_phone_uq on public.newsletter_subscribers (phone) where phone is not null;

alter table public.newsletter_subscribers enable row level security;

create policy "newsletter_subscribers_insert_public" on public.newsletter_subscribers
  for insert with check (true);
-- Deliberately no select/update/delete policy for anon or authenticated:
-- the signup form can never read back the list, and duplicate emails/phones
-- are rejected at the database level by the unique indexes above (the
-- client catches the unique-violation and shows a friendly "already
-- subscribed" message instead of creating a second row).
