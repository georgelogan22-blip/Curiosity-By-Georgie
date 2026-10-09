-- Curiously Georgie — Brisbane Air 50
-- Supabase schema for shared sightings, leaderboard, and hall of fame.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run from scratch on a
-- brand new project (it only creates things, nothing here drops data).

-- ---------------------------------------------------------------------
-- Table: sightings
-- One row per submitted sighting. A participant can log the same species
-- more than once (their own record of repeat sightings), but only the
-- first counts toward their tally — the leaderboard/hall-of-fame views
-- below handle that by counting DISTINCT species per participant.
-- ---------------------------------------------------------------------
create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),

  participant_name text not null check (char_length(trim(participant_name)) > 0),
  -- Normalised form used for grouping so "Ava T." and "ava t." are the
  -- same person on the leaderboard. Generated automatically — never set
  -- this column directly.
  participant_key text generated always as (lower(trim(participant_name))) stored,

  species text not null check (char_length(trim(species)) > 0),
  species_key text generated always as (lower(trim(species))) stored,

  sighting_date date not null,
  location text,
  notes text,

  -- 'confirmed' for now (tonight's scope has no photo/EXIF verification
  -- step yet — see the project notes). The column is here so that piece
  -- can be added later without a schema change: flip the default to
  -- 'pending' and have the review flow set it to 'confirmed'/'rejected'.
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'rejected')),

  created_at timestamptz not null default now()
);

create index if not exists sightings_participant_key_idx on public.sightings (participant_key);
create index if not exists sightings_species_key_idx on public.sightings (species_key);
create index if not exists sightings_status_idx on public.sightings (status);
create index if not exists sightings_created_at_idx on public.sightings (created_at);

-- ---------------------------------------------------------------------
-- Row Level Security: this table is reachable from the public website
-- with no login, so RLS is what stands in for a backend permission
-- check. Anyone can submit a sighting; anyone can read sightings (there's
-- no private data here — a nickname, a species, a date, a suburb — but
-- only the app's own queries ever expose them, filtered to 'confirmed'
-- for anything shown as a public tally). No one gets update/delete from
-- the public key — those stay admin-only via the Supabase dashboard.
-- ---------------------------------------------------------------------
alter table public.sightings enable row level security;

drop policy if exists "public can insert sightings" on public.sightings;
create policy "public can insert sightings"
  on public.sightings for insert
  to anon
  with check (true);

drop policy if exists "public can read sightings" on public.sightings;
create policy "public can read sightings"
  on public.sightings for select
  to anon
  using (true);

-- Note: the two `anon` policies above are currently unused by the live
-- site — submit_sighting() and participant_sightings() (added in later
-- migrations) handle inserts/reads instead, so no `anon` Data API grant
-- is added here for them. If a direct `.from("sightings")` call is ever
-- added back to assets/supabase-client.js, it'll need
-- `grant select, insert on public.sightings to anon;` alongside it —
-- Supabase stopped auto-granting that for new tables from 2026-10-30.

-- Explicit Data API grant — for the verify-sighting Edge Function,
-- which PATCHes a sighting's status directly via the REST API using the
-- service-role key (supabase/functions/verify-sighting/index.ts) after
-- running its AI photo check. Same 2026-10-30 auto-grant change as above.
grant update on public.sightings to service_role;

-- ---------------------------------------------------------------------
-- View: leaderboard
-- One row per participant, with their confirmed unique-species count.
-- Participants with zero confirmed species are left out entirely.
-- ---------------------------------------------------------------------
create or replace view public.leaderboard as
select
  participant_key,
  (array_agg(participant_name order by created_at desc))[1] as participant_name,
  count(distinct species_key) filter (where status = 'confirmed') as species_count,
  max(sighting_date) filter (where status = 'confirmed') as last_sighting
from public.sightings
group by participant_key
having count(distinct species_key) filter (where status = 'confirmed') > 0
order by species_count desc, last_sighting desc;

grant select on public.leaderboard to anon;

-- Hall of Fame (species_count >= 50) is just the leaderboard filtered on
-- the client side — see assets/supabase-client.js. Working out the exact
-- induction *date* (when a participant's confirmed species count first
-- reached 50) is done there too, by walking that participant's own
-- sightings in order — simpler than a distinct-count window query in SQL,
-- and each participant's row count is small enough that it's cheap.
