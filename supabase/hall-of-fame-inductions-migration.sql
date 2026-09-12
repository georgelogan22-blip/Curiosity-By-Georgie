-- Curiously Georgie — Brisbane Air 50: Hall of Fame manual review gate (v1.0)
--
-- George's decision, 2026-09-13: the automated per-sighting review (photo +
-- date check, confirmed one at a time as people log sightings) is enough for
-- day-to-day play — "I'm not trying to be a policeman." But the Hall of Fame
-- is permanent and public, so before anyone is actually published there,
-- George does one final manual look back over that participant's 50
-- confirmed official sightings — no new photo submission needed, since every
-- confirmed sighting already has its evidence photo sitting in the
-- "sighting-photos" storage bucket from when it was originally logged.
--
-- This migration adds a small table that IS the Hall of Fame: a participant
-- only appears on the public Hall of Fame page once George has added a row
-- for them here. Reaching air50_species_count >= 50 on the leaderboard just
-- means someone is ELIGIBLE for that final check — it no longer publishes
-- them automatically.
--
-- How to use: open your Supabase project → SQL Editor → New query, paste
-- this whole file, and click Run. Safe to re-run. Run this AFTER schema.sql,
-- registration-migration.sql, points-migration.sql, and
-- air50-hall-of-fame-migration.sql (it depends on air50_species_count
-- existing on the leaderboard view, and on participants existing).

create table if not exists public.hall_of_fame_inductions (
  -- Matches participants.participant_key exactly (same generated
  -- lower(trim(display_name)) value) — one induction row per participant.
  participant_key text primary key references public.participants(participant_key),
  -- The date to show on the Hall of Fame card. Defaults to today (when you
  -- run the insert) but you can backdate it if you want the card to reflect
  -- when they actually hit their 50th species rather than review day.
  inducted_at date not null default current_date,
  -- When George actually did the review — separate from inducted_at so the
  -- two dates can differ (e.g. reviewed today, but backdating inducted_at).
  reviewed_at timestamptz not null default now(),
  -- Optional private note for George's own records — never shown publicly.
  notes text
);

-- Public (anon) can only ever READ this table — there is deliberately no
-- insert/update/delete policy for anon, so the only way a row appears here
-- is George adding it himself via the Supabase Table Editor or SQL Editor
-- (both use the privileged service/postgres role, which bypasses RLS).
alter table public.hall_of_fame_inductions enable row level security;

drop policy if exists "hall_of_fame_inductions_select_all" on public.hall_of_fame_inductions;
create policy "hall_of_fame_inductions_select_all"
  on public.hall_of_fame_inductions
  for select
  using (true);

grant select on public.hall_of_fame_inductions to anon;

-- ---------------------------------------------------------------------
-- HOW TO INDUCT SOMEONE (do this after you've reviewed their 50 photos):
--
--   insert into public.hall_of_fame_inductions (participant_key, inducted_at)
--   values ('their-display-name-lowercased-trimmed', '2026-09-13');
--
-- participant_key is always lower(trim(display_name)) — e.g. if someone
-- registered as "Ava T.", their participant_key is "ava t.". You can look
-- it up exactly with:
--
--   select participant_key, participant_name from public.leaderboard
--   where air50_species_count >= 50;
--
-- (that query also doubles as your "who's currently eligible and waiting
-- on a review" list — anyone it returns who ISN'T yet in
-- hall_of_fame_inductions is waiting on you.)
-- ---------------------------------------------------------------------
