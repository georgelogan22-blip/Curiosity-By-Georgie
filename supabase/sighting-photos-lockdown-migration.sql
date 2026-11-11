-- Curiosity by Georgie — Brisbane Air 50: lock down the sighting-photos
-- storage bucket (v1.0)
--
-- Found 2026-11-11 going through Supabase's Security Advisor: the
-- sighting-photos bucket was fully public (public=true) AND had an
-- explicit "public can view sighting photos" RLS policy granting anon
-- SELECT on storage.objects for this bucket — meaning anyone could not
-- only fetch a photo by its path, but fully list/browse every photo ever
-- uploaded, confirmed or not. This directly contradicts the Privacy
-- Policy's promise that a sighting's photo and location stay visible
-- "only to us and to you" until the sighting is confirmed.
--
-- Checked first (2026-11-11) what this would and wouldn't break:
--   - participant_sightings() (my-sightings-migration.sql) embeds a
--     plain public URL in its photo_url column, but nothing in the
--     frontend (assets/my-sightings.js) actually reads or displays it —
--     confirmed by reading the file. Safe to stop returning a working
--     URL there; see the CREATE OR REPLACE below.
--   - pending_sightings_review (photo-verification-migration.sql) also
--     embeds a public URL, but anon/authenticated SELECT on that view was
--     already revoked in view-grants-lockdown-migration.sql (2026-11-09)
--     — only postgres/service_role can read it. George confirmed he
--     always looks up pending photos via Supabase Studio's Storage
--     browser rather than clicking the URL in his review-queue email, so
--     leaving that view's URL formatting as-is is harmless; not touched
--     by this migration.
--   - verify-sighting (the automated AI vision-check Edge Function)
--     fetches the photo via this same public URL — this WOULD break
--     automated review entirely once the bucket goes private. Fixed by
--     redeploying verify-sighting/index.ts with a service-role
--     authenticated fetch instead (see that file's own updated comments;
--     this migration doesn't touch Edge Function code).
--   - Photo uploads (assets/supabase-client.js, uploadSightingPhoto())
--     go through the separate "public can upload sighting photos" INSERT
--     policy on storage.objects, granted to anon with
--     with_check (bucket_id = 'sighting-photos'::text) — confirmed via
--     pg_policies and left untouched below. Flipping the bucket's public
--     flag and removing the SELECT policy has no effect on INSERT.
--   - avatar-photos and board-photos are deliberately left public — both
--     are meant to be publicly visible (avatars on the Leaderboard,
--     board photos on the community board) and aren't covered by the
--     Privacy Policy's pre-confirmation-privacy promise. Not touched.
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Safe to re-run.

-- 1. Stop serving sighting-photos via the fully-unauthenticated public
--    endpoint, and stop allowing anyone to list/browse the bucket.
update storage.buckets set public = false where id = 'sighting-photos';

-- 2. Remove the RLS policy that let anon SELECT (read) any object in
--    this bucket via the regular, API-key-authenticated endpoint — this
--    is the policy that actually controlled read access underneath the
--    public flag above, and needs removing too, or anon could still read
--    (just not list) every photo via its own API key.
drop policy if exists "public can view sighting photos" on storage.objects;

-- 3. Stop handing back a (now non-functional, and previously unnecessary)
--    public photo URL from participant_sightings() — confirmed unused by
--    the frontend. Keeps the photo_url column in the return shape (in
--    case anything unexpected depends on its presence) but always
--    returns null instead of a broken link. If a "view my own sighting
--    photos" feature is ever wanted on My Sightings, this is the function
--    to extend with a proper PIN-gated signed-URL lookup instead.
create or replace function public.participant_sightings(
  p_name text,
  p_pin_hash text
)
returns table (
  id uuid,
  species text,
  sighting_date date,
  location text,
  notes text,
  status text,
  review_confidence text,
  review_notes text,
  photo_url text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_name));
  v_participant public.participants;
begin
  select * into v_participant from public.participants where participant_key = v_key;

  if v_participant is null then
    raise exception 'not_registered';
  end if;

  if v_participant.pin_hash <> lower(trim(p_pin_hash)) then
    raise exception 'invalid_pin';
  end if;

  return query
  select
    s.id,
    s.species,
    s.sighting_date,
    s.location,
    s.notes,
    s.status,
    s.review_confidence,
    s.review_notes,
    null::text as photo_url,
    s.created_at
  from public.sightings s
  where s.participant_key = v_key
  order by s.created_at desc;
end;
$$;

grant execute on function public.participant_sightings(text, text) to anon;
