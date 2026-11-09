-- Curiosity by Georgie — Brisbane Air 50: Minor avatar-photo upload gate (v1.0)
--
-- Fix for a live compliance gap found 2026-11-09 while working through
-- item 4 of the 2026-11-08 legal build punch list. Terms clause 12.2
-- and the Privacy Policy ("Minors cannot upload their own image as an
-- Avatar and must choose from the images we provide") both require this,
-- but avatar-photo-migration.sql's update_participant_avatar_photo()
-- never actually checked it — any participant who knew their own
-- name+PIN could upload a photo avatar on My Sightings, Minor or not,
-- with nothing stopping them.
--
-- This closes the gap server-side, which is the only place it actually
-- matters — a client-side-only check can always be bypassed by calling
-- the RPC directly — and extends participant_dashboard() with a plain
-- is_minor boolean (never the actual date of birth) so the My Sightings
-- picker (assets/my-sightings.js) can hide the upload option for a Minor
-- entirely, instead of showing it and letting them hit a server error.
--
-- Run this AFTER avatar-photo-migration.sql, the same way: Supabase
-- project → SQL Editor → New query, paste this whole file, Run. Safe to
-- re-run.

-- ---------------------------------------------------------------------
-- Function: update_participant_avatar_photo (REPLACES the version in
-- avatar-photo-migration.sql) — now rejects SETTING a photo (p_photo_path
-- not null) for a participant who is a Minor. Removing a photo
-- (p_photo_path = null) is still always allowed, including for a Minor,
-- so there's no way to get stuck with a photo you can no longer take
-- down. Same age test as parent-consent-migration.sql's v_is_minor.
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
  v_is_minor boolean;
begin
  select * into v_participant from public.participants where participant_key = v_key;

  if v_participant is null then
    raise exception 'not_registered';
  end if;

  if v_participant.pin_hash <> lower(trim(p_pin_hash)) then
    raise exception 'invalid_pin';
  end if;

  v_is_minor := v_participant.date_of_birth > (current_date - interval '18 years');

  if p_photo_path is not null and v_is_minor then
    raise exception 'minor_cannot_upload_photo';
  end if;

  update public.participants
  set avatar_photo_path = p_photo_path
  where participant_key = v_key;
end;
$$;

grant execute on function public.update_participant_avatar_photo(text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Function: participant_dashboard (REPLACES the version in
-- avatar-photo-migration.sql) — same as before, now also returns
-- is_minor so the front end can hide the photo-upload control for a
-- Minor rather than showing it and relying on the error above. Postgres
-- won't let `create or replace function` change a function's OUT row
-- type, so the old 5-column version has to be dropped first, same as
-- avatar-photo-migration.sql itself had to do.
-- ---------------------------------------------------------------------
drop function if exists public.participant_dashboard(text, text);

create or replace function public.participant_dashboard(
  p_name text,
  p_pin_hash text
)
returns table (
  display_name text,
  avatar_key text,
  avatar_photo_path text,
  is_minor boolean,
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
    (v_participant.date_of_birth > (current_date - interval '18 years')),
    coalesce(lb.species_count, 0)::int,
    coalesce(lb.total_points, 0)::int
  from (select 1) as one_row
  left join public.leaderboard lb on lb.participant_key = v_key;
end;
$$;

grant execute on function public.participant_dashboard(text, text) to anon;
