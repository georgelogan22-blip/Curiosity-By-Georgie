-- Curiosity by Georgie — Brisbane Air 50: fix the pending review queue's
-- photo link (v1.1)
--
-- Found 2026-11-20: pending_sightings_review (photo-verification-migration.sql)
-- still built its photo_url column from the old public bucket endpoint,
-- which stopped resolving the moment sighting-photos-lockdown-migration.sql
-- (2026-11-11) made the sighting-photos bucket private. George clicked a
-- photo_url from the queue and got nothing. That earlier migration's own
-- notes anticipated this and said George would look pending photos up via
-- Supabase Studio's Storage browser instead — this migration just makes
-- that a single click rather than a manual search.
--
-- Photos are stored flat at the bucket root as <uuid>.<ext>
-- (uploadSightingPhoto() in assets/supabase-client.js never nests them in
-- a folder), so a Studio Storage deep link only needs the bucket's
-- "preview" query param to open straight to the right file — no folder
-- path to resolve first. (This deep-link feature is fairly new in
-- Supabase Studio — if it ever stops working, photo_path below is kept
-- as a fallback: Storage → sighting-photos → paste/search that filename.)
--
-- Replaces the dead photo_url column with:
--   - photo_path        — the raw storage filename (unchanged data, just
--                          now visible, as a manual-lookup fallback)
--   - photo_review_link — a direct Supabase Studio link that opens the
--                          Storage browser with that exact photo already
--                          previewed
--
-- v1.1: swapping photo_url out for photo_path/photo_review_link means
-- dropping a column, which `create or replace view` refuses to do
-- (42P16). Drop and recreate instead, then re-apply the same "George
-- only" lockdown view-grants-lockdown-migration.sql (2026-11-09) set up,
-- since a freshly created view starts with no grants of its own.
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Safe to re-run.

drop view if exists public.pending_sightings_review;

create view public.pending_sightings_review as
select
  id,
  participant_name,
  species,
  sighting_date,
  location,
  notes,
  photo_taken_at,
  review_confidence,
  review_notes,
  photo_path,
  case when photo_path is not null
    then 'https://supabase.com/dashboard/project/nduhuiihmagptvrxgkhk/storage/buckets/sighting-photos?preview=' || photo_path
    else null
  end as photo_review_link,
  created_at
from public.sightings
where status = 'pending'
order by created_at asc;

-- Deliberately NOT granted to anon/authenticated — this stays George's
-- own dashboard-only moderation view, same as before.
revoke all on public.pending_sightings_review from anon, authenticated;
