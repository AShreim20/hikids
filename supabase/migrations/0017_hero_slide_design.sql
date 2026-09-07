-- Hero carousel redesign: per-slide content positioning, overlay/text-color
-- treatment, optional Desktop/Mobile media (image or video), individual
-- display duration, and optional active-window scheduling.
--
-- Reuses the existing hero_slides table and `image_url` column (now framed
-- as "Desktop Media" — its role, not its DB name, changes) rather than
-- introducing a second slide system. `media_type` says whether image_url is
-- an image or a video; `mobile_image_url`/`mobile_media_type` are the
-- optional Mobile Media override, falling back to the desktop media at
-- render time when absent.

alter table public.hero_slides
  add column secondary_cta_label text,
  add column secondary_cta_link text,
  add column content_position text not null default 'center' check (content_position in ('left', 'center', 'right')),
  add column vertical_position text not null default 'center' check (vertical_position in ('top', 'center', 'bottom')),
  add column overlay_strength text not null default 'medium' check (overlay_strength in ('none', 'light', 'medium', 'strong')),
  add column text_color text not null default 'auto' check (text_color in ('auto', 'light', 'dark')),
  add column media_type text not null default 'image' check (media_type in ('image', 'video')),
  add column mobile_image_url text,
  add column mobile_media_type text check (mobile_media_type in ('image', 'video')),
  add column focal_position text not null default 'center' check (focal_position in ('left', 'center', 'right')),
  add column duration_seconds integer not null default 5 check (duration_seconds between 2 and 30),
  add column video_duration_mode text not null default 'custom' check (video_duration_mode in ('auto', 'custom')),
  add column display_start timestamptz,
  add column display_end timestamptz;

-- Migration defaults for existing rows: every other new column's own DEFAULT
-- already gives the right value for a pre-existing slide (5s duration,
-- medium overlay, auto text color, image media, center vertical, no
-- schedule) — content_position is the one field where the current on-screen
-- result isn't the column default ('center'): the existing layout renders
-- text at the reading-start edge, which for this Arabic-primary storefront
-- is the right side, so that's the closest equivalent for content already
-- live today.
update public.hero_slides set content_position = 'right';
