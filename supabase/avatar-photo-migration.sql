-- Curiously Georgie — Brisbane Air 50: avatar photo uploads (v1.0)
--
-- George's ask, 2026-09-18: let participants upload their own photo as
-- their "character" instead of (or alongside) the 8 illustrated bird
-- icons from avatar-migration.sql, and show it wherever their name
-- appears — Leaderboard, Hall of Fame, and the Community Board — not
-- just on My Sightings. See assets/my-sightings.js, assets/avatars.js,
-- leaderboard.html, hall-of-fame.html, chat.html/assets/chat.js for the
-- front end this supports.
--
-- Moderation, per George's explicit call: a photo goes live the moment
-- it's uploaded (same posture as Community Board photos already) —
-- there is no review queue for this. George can remove one after the
-- fact via the Supabase dashboard (see "TO REMOVE AN INAPPROPRIATE
-- AVATAR PHOTO" at the bottom of this file) the same way he moderates a
-- board post.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — everything
-- here uses `if not exists` / `or replace` / `drop ... if exists`. Run
-- this AFTER avatar-migration.sql (it extends the same avatar_key
-- column/functions) and after points-migration.sql /
-- air50-hall-of-fame-migration.sql (it extends the leaderboard view).

-- ---------------------------------------------------------------------
-- Storage bucket: avatar-photos
-- Same pattern as board-photos: public read (so an avatar photo is
-- visible to anyone browsing the site, wherever that participant's name
-- appears), anyone can upload — but note a photo only actually becomes
-- someone's avatar via update_participant_avatar_photo() below, which
-- checks their PIN first. No update/delete for anyone, including the
-- uploader — same "can't silently swap what's already public" posture
-- as every other photo bucket on this site. An old, replaced avatar
-- photo is simply no longer referenced by any participant row, not
-- deleted — harmless orphaned storage, tidy up occasionally if it ever
-- matters.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatar-photos', 'avatar-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can upload avatar photos" on storage.objects;
create policy "public can upload avatar photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'avatar-photos');

drop policy if exists "public can view avatar photos" on storage.objects;
create policy "public can view avatar photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'avatar-photos');

-- ---------------------------------------------------------------------
-- Column: participants.avatar_photo_path
-- Nullable — when set, the front end shows this photo instead of the
-- chosen avatar_key icon (a photo always wins over an icon when both are
-- present). Picking one of the 8 icons explicitly clears this back to
-- null (see update_participant_avatar() below) so choosing an icon
-- always visibly takes effect, rather than silently doing nothing while
-- a photo keeps showing.
-- ---------------------------------------------------------------------
alter table public.participants add column if not exists avatar_photo_path text;

-- ---------------------------------------------------------------------
-- Function: update_participant_avatar (REPLACES the version in
-- avatar-migration.sql) — same checks, now also clears avatar_photo_path
-- whenever an icon is chosen, so the icon picker always visibly wins.
-- ---------------------------------------------------------------------
create or replace function public.update_participant_avatar(
  p_name text,
  p_pin_hash text,
  p_avatar_key text
)
returns void
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

  if p_avatar_key is not null and p_avatar_key not in (
    'lorikeet', 'kookaburra', 'magpie', 'cockatoo',
    'galah', 'wagtail', 'pelican', 'eagle'
  ) then
    raise exception 'invalid_avatar';
  end if;

  update public.participants
  set avatar_key = p_avatar_key, avatar_photo_path = null
  where participant_key = v_key;
end;
$$;

grant execute on function public.update_participant_avatar(text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Function: update_participant_avatar_photo
-- Same PIN-gated pattern. p_photo_path is the object path inside the
-- avatar-photos bucket (not a full URL) returned by the upload step, or
-- null to remove the photo and revert to whichever icon (if any) is
-- still stored in avatar_key.
-- ---------------------------------------------------------------------
create or replace function public.update_participant_avatar_photo(
  p_name text,
  p_pin_hash text,
  p_photo_path text
)
returns void
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

  update public.participants
  set avatar_photo_path = p_photo_path
  where participant_key = v_key;
end;
$$;

grant execute on function public.update_participant_avatar_photo(text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Function: participant_dashboard (REPLACES the version in
-- avatar-migration.sql) — same as before, now also returns
-- avatar_photo_path so My Sightings knows whether to show the photo or
-- the icon.
-- ---------------------------------------------------------------------
create or replace function public.participant_dashboard(
  p_name text,
  p_pin_hash text
)
returns table (
  display_name text,
  avatar_key text,
  avatar_photo_path text,
  species_count int,
  total_points int
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
    v_participant.display_name,
    v_participant.avatar_key,
    v_participant.avatar_photo_path,
    coalesce(lb.species_count, 0)::int,
    coalesce(lb.total_points, 0)::int
  from (select 1) as one_row
  left join public.leaderboard lb on lb.participant_key = v_key;
end;
$$;

grant execute on function public.participant_dashboard(text, text) to anon;

-- ---------------------------------------------------------------------
-- View: participant_avatars
-- A narrow, public-read window onto participants — ONLY the three
-- avatar-related columns, never the sensitive registration fields
-- (full legal name, DOB, address, phone, email) that participants
-- itself deliberately has no public SELECT policy for. This is what
-- lets the Community Board (chat.html) show an avatar next to each
-- post/comment: board_posts/board_comments store participant_name
-- denormalised with no foreign key to participants, so the front end
-- looks up each poster's avatar by matching participant_key client-side
-- against this view (see fetchParticipantAvatars() in
-- assets/supabase-client.js). Leaderboard rows and Hall of Fame cards
-- get their avatar columns directly from the leaderboard view below
-- instead, since they already join participants there.
-- ---------------------------------------------------------------------
create or replace view public.participant_avatars as
select participant_key, avatar_key, avatar_photo_path
from public.participants;

grant select on public.participant_avatars to anon;

-- ---------------------------------------------------------------------
-- View: leaderboard (REPLACES the version in air50-hall-of-fame-migration.sql)
-- Identical to that version, with two new trailing columns —
-- avatar_key, avatar_photo_path — added via a left join to participants
-- (Postgres's create or replace view only allows appending columns at
-- the end, never in the middle, without dropping the view first, same
-- constraint noted in air50-hall-of-fame-migration.sql). Only these two
-- narrow columns are selected from participants, never the sensitive
-- registration fields, so this view stays exactly as safe to expose
-- publicly as it already was.
-- ---------------------------------------------------------------------
create or replace view public.leaderboard as
with species_first_seen as (
  select
    participant_key,
    species_key,
    min(created_at) as first_logged_at
  from public.sightings
  where status = 'confirmed'
  group by participant_key, species_key
),
participant_activity as (
  select
    participant_key,
    (array_agg(participant_name order by created_at desc))[1] as participant_name,
    max(sighting_date) as last_sighting
  from public.sightings
  where status = 'confirmed'
  group by participant_key
)
select
  sfs.participant_key,
  pa.participant_name,
  count(distinct sfs.species_key) as species_count,
  pa.last_sighting,
  coalesce(sum(coalesce(sr.points, 0)), 0) as total_points,
  count(distinct sfs.species_key) filter (where sr.species_key is not null) as air50_species_count,
  p.avatar_key,
  p.avatar_photo_path
from species_first_seen sfs
join participant_activity pa on pa.participant_key = sfs.participant_key
left join public.species_reference sr on sr.species_key = sfs.species_key
left join public.participants p on p.participant_key = sfs.participant_key
group by sfs.participant_key, pa.participant_name, pa.last_sighting, p.avatar_key, p.avatar_photo_path
having count(distinct sfs.species_key) > 0
order by total_points desc, air50_species_count desc, species_count desc, pa.last_sighting desc;

grant select on public.leaderboard to anon;

-- ---------------------------------------------------------------------
-- TO REMOVE AN INAPPROPRIATE AVATAR PHOTO:
--   1. Table Editor → participants → find the participant's row →
--      clear their avatar_photo_path cell (set it to null) — their
--      avatar immediately reverts to whichever icon they last chose, or
--      the neutral placeholder if they never chose one.
--   2. Optional cleanup: Storage → avatar-photos bucket → delete the
--      now-unreferenced file. Not required — an orphaned file in
--      storage isn't linked from anywhere and isn't shown to anyone.
-- ---------------------------------------------------------------------
