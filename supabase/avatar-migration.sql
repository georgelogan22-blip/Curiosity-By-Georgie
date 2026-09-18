-- Curiously Georgie — Brisbane Air 50: My Sightings dashboard (v1.0)
--
-- Turns "My Sightings" from a plain status-check form into a personal
-- dashboard: a chosen bird "character" avatar, a live level (Air Novice
-- through Air Master, based on confirmed species count), and total Air
-- Points — alongside the existing pending/confirmed/rejected sightings
-- lookup. See assets/my-sightings.js and my-sightings.html for the
-- front end this supports.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — everything
-- here uses `add column if not exists` / `create or replace`. Run this
-- AFTER schema.sql, registration-migration.sql, and points-migration.sql
-- (it reads public.participants and public.leaderboard).

-- ---------------------------------------------------------------------
-- Column: participants.avatar_key
-- The bird character a participant has chosen for their dashboard.
-- Nullable — a participant who registered before this existed (or just
-- hasn't picked one yet) simply has no avatar_key, and the front end
-- shows a neutral placeholder until they choose one. The allowed set is
-- enforced here AND in update_participant_avatar() below, so a bad
-- value can't reach this column by any path; if the avatar set ever
-- changes, update both the check constraint and the function together
-- (and assets/avatars.js on the front end, which is the single source
-- of truth for what each key looks like).
-- ---------------------------------------------------------------------
alter table public.participants add column if not exists avatar_key text;

alter table public.participants drop constraint if exists participants_avatar_key_check;
alter table public.participants add constraint participants_avatar_key_check
  check (avatar_key is null or avatar_key in (
    'lorikeet', 'kookaburra', 'magpie', 'cockatoo',
    'galah', 'wagtail', 'pelican', 'eagle'
  ));

-- ---------------------------------------------------------------------
-- Function: update_participant_avatar
-- PIN-gated, same pattern as toggle_post_curious()/submit_sighting() —
-- verifies the display name is registered and the PIN matches before
-- writing. p_avatar_key must be one of the allowed set above, or null
-- to clear it back to no avatar chosen.
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

  update public.participants set avatar_key = p_avatar_key where participant_key = v_key;
end;
$$;

grant execute on function public.update_participant_avatar(text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Function: participant_dashboard
-- PIN-gated, same checks as participant_sightings() (see
-- my-sightings-migration.sql), which stays exactly as-is and is still
-- called separately for the actual sighting rows — this function only
-- adds the profile-level summary: display name, chosen avatar, and the
-- same species_count/total_points the public Leaderboard already shows
-- (read from the public.leaderboard view so the numbers can never drift
-- out of sync with it), defaulting to 0 for a participant with no
-- confirmed sightings yet rather than being absent from the result.
-- ---------------------------------------------------------------------
create or replace function public.participant_dashboard(
  p_name text,
  p_pin_hash text
)
returns table (
  display_name text,
  avatar_key text,
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
    coalesce(lb.species_count, 0)::int,
    coalesce(lb.total_points, 0)::int
  from (select 1) as one_row
  left join public.leaderboard lb on lb.participant_key = v_key;
end;
$$;

grant execute on function public.participant_dashboard(text, text) to anon;
