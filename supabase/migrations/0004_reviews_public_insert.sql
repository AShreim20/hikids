-- Base44's Review entity had create: null (fully public -- Reviews.jsx's
-- text-review path never checks `if (!user)`, so guests can leave text
-- reviews). The Phase 0 migration wrote an authenticated-only insert policy
-- by mistake; fix it to match.
drop policy "reviews_insert_authenticated" on public.reviews;

create policy "reviews_insert_public" on public.reviews
  for insert with check (true);
