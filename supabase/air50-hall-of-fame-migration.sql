-- Curiously Georgie — Brisbane Air 50: Hall of Fame / Air 50 count fix (v1.0)
--
-- George's decision, 2026-09-13: Hall of Fame should require confirming
-- all 50 *official* Brisbane Air 50 species specifically — not just any
-- 50 distinct species. Participants remain free to log birds outside the
-- official list (rules.html already says so) and those sightings still
-- show up in their overall tally, but they should never (a) earn Air
-- Points, or (b) count toward Hall of Fame induction on their own.
--
-- Two things the original `leaderboard` view (schema.sql, then
-- points-migration.sql) got wrong for this:
--   1. total_points used coalesce(sr.points, 1) — an off-list species
--      still earned the minimum tier's 1 point rather than 0. That meant
--      a participant could reach the "finish line" points total (219 —
--      the sum of all 50 official species' Air Points, see the sanity
--      check at the bottom of this file) partly on off-list padding
--      rather than genuinely confirming every official species.
--   2. Hall of Fame eligibility (species_count >= 50, checked client-side
--      in assets/supabase-client.js's fetchHallOfFame()) counted ANY
--      distinct confirmed species, official or not — so 50 freeform,
--      off-list sightings alone could reach the Hall of Fame with zero
--      official species confirmed.
--
-- This migration fixes #1 (points) here in SQL, and adds a new
-- air50_species_count column so the client can fix #2 by gating on that
-- instead of the old species_count. See fetchHallOfFame() in
-- assets/supabase-client.js (and preview-artifact.html's mirror of it)
-- for the corresponding client-side change.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run (create or
-- replace view). Run this AFTER schema.sql, registration-migration.sql,
-- and points-migration.sql.

create or replace view public.leaderboard as
with species_first_seen as (
  -- One row per participant per distinct confirmed species — this is
  -- what "counts" (repeat sightings of the same species are logged but
  -- collapse to a single row here, so they can't inflate points or the
  -- tally).
  select
    participant_key,
    species_key,
    min(created_at) as first_logged_at
  from public.sightings
  where status = 'confirmed'
  group by participant_key, species_key
),
participant_activity as (
  -- Display name (most recently-used spelling) and most recent sighting
  -- date, over ALL of a participant's confirmed sightings (repeats
  -- included) — this is just "how active/recent", not a tally.
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
  -- Every distinct confirmed species, official Brisbane Air 50 or not —
  -- a participant's overall "how many different birds have I logged"
  -- stat, shown on the Leaderboard, but NOT what gates Hall of Fame
  -- entry any more (see air50_species_count below).
  count(distinct sfs.species_key) as species_count,
  pa.last_sighting,
  -- A species not in species_reference (typed freeform, not one of the
  -- official 50) is now worth ZERO points, via coalesce(sr.points, 0) —
  -- changed from coalesce(sr.points, 1) in points-migration.sql, so
  -- off-list sightings can no longer pad a participant's way toward the
  -- 219-point "all 50 official species" finish line. Off-list sightings
  -- still show up in species_count above, just contribute nothing here.
  coalesce(sum(coalesce(sr.points, 0)), 0) as total_points,
  -- New: how many of the 50 OFFICIAL Brisbane Air 50 species this
  -- participant has confirmed — this, not species_count, is what Hall
  -- of Fame induction (>= 50) should check from now on. Appended as the
  -- last column (Postgres's create or replace view only allows adding
  -- columns at the end, never in the middle, without dropping the view
  -- first).
  count(distinct sfs.species_key) filter (where sr.species_key is not null) as air50_species_count
from species_first_seen sfs
join participant_activity pa on pa.participant_key = sfs.participant_key
left join public.species_reference sr on sr.species_key = sfs.species_key
group by sfs.participant_key, pa.participant_name, pa.last_sighting
having count(distinct sfs.species_key) > 0
order by total_points desc, air50_species_count desc, species_count desc, pa.last_sighting desc;

grant select on public.leaderboard to anon;

-- Sanity check after running: the maximum possible total_points is the
-- sum of every official species' points in species_reference — 219 as
-- of this file (15x1 + 10x2 + 7x3 + 6x5 + 6x8 + 5x13 + 1x20 = 219),
-- which is also exactly what a participant has once air50_species_count
-- reaches 50. Confirm with:
--   select sum(points) from public.species_reference;  -- should be 219
