-- FAQ page: replace the dead-end "لديك سؤال آخر؟" CTA (a link back to the
-- shop) with a real customer question form. No inquiry system existed
-- before this migration.
--
-- Mirrors the newsletter_subscribers pattern (0018): guest-writable,
-- public INSERT only, everything else admin-only — the client always calls
-- db.CustomerInquiry.create(payload, { returning: false }), same as the
-- newsletter form and guest checkout, so a customer can never read back
-- another customer's inquiry (no SELECT policy for anon/authenticated at
-- all). Only an admin (is_admin()) can list/read/update.
create table public.customer_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  -- Set for a logged-in customer, null for a guest submission. Kept even if
  -- the account is later deleted (set null, not cascade) since the inquiry
  -- itself should still be readable by an admin.
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  question text not null,
  status text not null default 'new',
  constraint customer_inquiries_status_chk check (status in ('new', 'reviewed', 'replied')),
  -- "At least one valid contact method" (name is already required above).
  constraint customer_inquiries_contact_chk check (customer_phone is not null or customer_email is not null),
  -- Reasonable length limits — defense in depth alongside the client-side
  -- validation, same spirit as every other free-text column in this schema.
  constraint customer_inquiries_name_len_chk check (char_length(customer_name) between 1 and 200),
  constraint customer_inquiries_question_len_chk check (char_length(question) between 1 and 2000),
  constraint customer_inquiries_phone_len_chk check (customer_phone is null or char_length(customer_phone) <= 40),
  constraint customer_inquiries_email_len_chk check (customer_email is null or char_length(customer_email) <= 200)
);

create index customer_inquiries_status_idx on public.customer_inquiries (status, created_date desc);
create index customer_inquiries_customer_id_idx on public.customer_inquiries (customer_id);

create trigger customer_inquiries_set_updated_date
  before update on public.customer_inquiries
  for each row execute function public.set_updated_date();

alter table public.customer_inquiries enable row level security;

-- Simple spam guard usable from an anon INSERT's WITH CHECK: a plain
-- correlated subquery there would see zero rows (RLS blocks anon SELECT on
-- this table entirely), so this needs to be SECURITY DEFINER, the same
-- reason is_admin()/has_permission() are — it only ever returns a boolean
-- count check, never row data.
create or replace function public.customer_inquiry_rate_ok(p_phone text, p_email text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select count(*) < 3
  from public.customer_inquiries
  where created_date > now() - interval '10 minutes'
    and (
      (p_phone is not null and customer_phone = p_phone)
      or (p_email is not null and lower(customer_email) = lower(p_email))
    );
$$;

create policy "customer_inquiries_insert_public" on public.customer_inquiries
  for insert with check (
    char_length(trim(customer_name)) > 0
    and char_length(trim(question)) > 0
    and (customer_phone is not null or customer_email is not null)
    and public.customer_inquiry_rate_ok(customer_phone, customer_email)
  );

create policy "customer_inquiries_admin_select" on public.customer_inquiries
  for select using (public.is_admin());

create policy "customer_inquiries_admin_update" on public.customer_inquiries
  for update using (public.is_admin()) with check (public.is_admin());
