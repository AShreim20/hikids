-- Storage security fix (pre-launch review, PART 1). The "uploads" bucket
-- previously existed only via a dashboard change, never a migration --
-- this migration is the first time its intended configuration is
-- represented in the repository, and it tightens that configuration.
--
-- Full upload inventory (grep-verified: src/lib/uploadFile.js is the ONLY
-- code in this repo that ever touches Supabase Storage -- no Edge Function
-- touches it either):
--
--   Admin-only (every call site is inside a page gated by
--   `user?.role !== 'admin'`, either directly or via its parent page):
--     - ProductFormFields.jsx / ProductImageManager.jsx -- product photos
--     - ProductFormFields.jsx's own video field           -- product video
--     - OptionsEditor.jsx                                 -- variant option images
--     - Categories.jsx                                    -- category images
--     - HeroSlideForm.jsx (image AND video slides)        -- homepage hero/carousel
--     - BundleEditor.jsx                                  -- bundle images
--     - SiteSettingsAdmin.jsx                              -- store logo
--   ("About page uploads" from the review's own inspection list do not
--   exist -- About.jsx / SiteContentAdmin.jsx are text-only, confirmed by
--   grep.)
--
--   Customer-facing (any authenticated customer, not admin-gated):
--     - Reviews.jsx    -- product photo reviews; shown PUBLICLY on the
--       storefront once approved (and to the submitter regardless of
--       status) -- confirmed via its own `photo_url` rendering.
--     - Challenges.jsx -- challenge photo submissions; confirmed via grep
--       that `file_url` is rendered ONLY in ChallengesAdmin.jsx (admin
--       review) -- never shown publicly or even back to the submitter.
--
-- Before this migration: one bucket ("uploads"), public / unlimited size /
-- any mime type, with an INSERT policy that only checked
-- `auth.role() = 'authenticated'` -- any self-registered customer could
-- write anywhere in it, including overwriting admin product/category/
-- hero/bundle/logo assets, with a file of any size or type.
--
-- After this migration: two buckets, split because the admin bucket
-- genuinely needs video support (existing hero-slide and product-video
-- uploads) that customer uploads should never get, and Supabase's
-- bucket-level file_size_limit/allowed_mime_types apply per-bucket, not
-- per-path -- one bucket can't safely enforce "admin: images or video" and
-- "customer: images only" at once.
--
--   uploads (existing bucket, existing flat/unprefixed paths -- every
--   current file and every admin call site above is completely
--   unaffected, zero path or code changes needed there):
--     write (insert/update/delete): admin only.
--     read: public (product/category/hero/bundle/logo images and videos
--     are meant to be visible to every visitor).
--     size limit: 25 MB (comfortably covers the existing largest files --
--     5.6 MB image, 3.4 MB video -- plus real headroom for a higher-res
--     product photo or a longer hero video, still bounded).
--     mime types: image/jpeg, image/png, image/webp, image/gif (the four
--     raster formats components/ui/image.jsx's own transform pipeline
--     already explicitly understands), video/mp4, video/webm (exactly
--     what HeroSlideForm.jsx's own <input accept> already declares --
--     ProductFormFields.jsx's video field uses the looser accept="video/*"
--     but every video actually stored today is mp4, so this is a real
--     tightening, not a functional loss).
--
--   customer-uploads (new bucket, dedicated to the two customer-facing
--   upload features above):
--     paths: reviews/<uid>/<file> and challenges/<uid>/<file> -- the <uid>
--     segment is the uploader's own auth.uid(), enforced by the INSERT
--     policy below, so a customer can never write into another
--     customer's folder (no overwrite/delete of someone else's upload)
--     and never into a path outside these two prefixes (no reaching admin
--     asset territory even in principle -- it isn't the same bucket).
--     write (insert): the authenticated caller, only into their own uid
--     folder under reviews/ or challenges/; or an admin (blanket, for
--     moderation). update/delete: admin only -- neither feature has an
--     "edit/remove my own upload" UI today, so that's the safe default.
--     read: public. Product-review photos need this (shown on the
--     storefront to every visitor once approved). Challenge photos don't
--     strictly need it -- confirmed only ChallengesAdmin.jsx ever renders
--     one -- and the review explicitly suggested preferring private
--     access there; a genuinely private read would need
--     ChallengesAdmin.jsx reworked to fetch short-lived signed URLs
--     instead of the permanent public URL this app stores in
--     challenge_submissions.file_url everywhere else, which is a real
--     architecture change outside this task's "keep it simple, don't
--     redesign" scope. Left public read as a deliberate, disclosed
--     trade-off: the actual risk is low (an unguessable, per-user, random
--     UUID path, with no listing/enumeration endpoint exposed to anyone
--     but an admin), and the explicitly required protection -- no
--     unauthorized WRITE -- is fully enforced below regardless.
--     size limit: 10 MB (comfortably covers a modern phone photo,
--     including a HEIC-converted JPEG from a recent iPhone, without being
--     an open door).
--     mime types: image/jpeg, image/png, image/webp, image/gif only --
--     no video, no svg (svg is a script-execution risk if ever rendered
--     inline, and nothing here ever needs it).

update storage.buckets
set public = true,
    file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']
where id = 'uploads';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-uploads', 'customer-uploads', true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── uploads: admin-only write, public read ──────────────────────────────
drop policy if exists "uploads_authenticated_insert" on storage.objects;
drop policy if exists "uploads_public_read" on storage.objects;
drop policy if exists "uploads_admin_update" on storage.objects;
drop policy if exists "uploads_admin_delete" on storage.objects;

create policy "uploads_select" on storage.objects
  for select using (bucket_id = 'uploads');

create policy "uploads_admin_insert" on storage.objects
  for insert with check (bucket_id = 'uploads' and public.is_admin());

create policy "uploads_admin_update" on storage.objects
  for update using (bucket_id = 'uploads' and public.is_admin())
  with check (bucket_id = 'uploads' and public.is_admin());

create policy "uploads_admin_delete" on storage.objects
  for delete using (bucket_id = 'uploads' and public.is_admin());

-- ── customer-uploads: own-folder-only write, admin-managed otherwise ────
create policy "customer_uploads_select" on storage.objects
  for select using (bucket_id = 'customer-uploads');

create policy "customer_uploads_insert" on storage.objects
  for insert with check (
    bucket_id = 'customer-uploads' and (
      public.is_admin()
      or (
        auth.role() = 'authenticated'
        and (storage.foldername(name))[1] in ('reviews', 'challenges')
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

create policy "customer_uploads_admin_update" on storage.objects
  for update using (bucket_id = 'customer-uploads' and public.is_admin())
  with check (bucket_id = 'customer-uploads' and public.is_admin());

create policy "customer_uploads_admin_delete" on storage.objects
  for delete using (bucket_id = 'customer-uploads' and public.is_admin());
