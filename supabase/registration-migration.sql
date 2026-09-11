-- Curiously Georgie — Brisbane Air 50: Registration migration (v1.0)
--
-- Adds a real, one-time registration step before someone can log
-- sightings. George's reasons for this (both should be understood by
-- whoever reads this later): (1) the challenge carries real physical
-- risk (wildlife encounters, and more so once Land 50/Water 50 launch),
-- so participants should go through a proper sign-up rather than just
-- typing a name into a form; (2) collecting real contact details makes
-- it possible to permanently ban someone who causes abuse or harm to
-- other participants or to wildlife/nature — see "Banning a
-- participant" below.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — everything
-- here uses `if not exists` / `or replace` / `drop ... if exists`.
-- Run this AFTER schema.sql and points-migration.sql.

-- ---------------------------------------------------------------------
-- Table: participants
-- One row per registered participant. Two names are deliberately kept
-- separate:
--   - display_name: what they play under — shown on the Leaderboard/
--     Hall of Fame, exactly like today. Can be a nickname.
--   - full_legal_name: their real name, collected for the finisher's
--     coin post-out and as a registration record. NEVER shown on any
--     public page, and not selectable by the public API at all (see
--     RLS below) — it only exists for George to read via the Supabase
--     dashboard when preparing to post out coins or handling a report.
-- participant_key is generated from display_name the same way
-- sightings.participant_key already is, so the two line up.
-- ---------------------------------------------------------------------
create table if not exists public.participants (
  display_name text not null check (char_length(trim(display_name)) > 0),
  participant_key text generated always as (lower(trim(display_name))) stored primary key,

  full_legal_name text not null check (char_length(trim(full_legal_name)) > 0),
  date_of_birth date not null check (date_of_birth <= current_date),

  address_line text not null check (char_length(trim(address_line)) > 0),
  suburb text not null check (char_length(trim(suburb)) > 0),
  state text not null check (char_length(trim(state)) > 0),
  postcode text not null check (char_length(trim(postcode)) > 0),

  phone text not null check (char_length(trim(phone)) > 0),
  email text not null check (char_length(trim(email)) > 0),

  -- Only meaningful (and only required to be true) when date_of_birth
  -- puts the participant under 18 at the moment they register — see the
  -- check constraint below. A simple self-declared tickbox, not a
  -- verified parent identity/contact — George's explicit choice, kept
  -- simple for now; can be strengthened later (e.g. collecting a
  -- parent/guardian's own name + email) without a schema change beyond
  -- adding nullable columns.
  parental_consent boolean not null default false,

  -- A 4-digit PIN the participant chooses at registration, required
  -- alongside their display name to log a sighting afterward — added so
  -- someone can't log sightings under a name they don't own just by
  -- guessing/knowing it (George's ask, 2026-09-10). Stored only as a
  -- SHA-256 hex digest (64 lowercase hex chars), computed client-side —
  -- the raw PIN is never sent to or stored by Supabase. This is a
  -- friction/deterrent measure, not bank-grade security (a 4-digit PIN
  -- only has 10,000 possibilities) — it matches the stated goal of
  -- stopping casual impersonation on a free, no-password community site,
  -- not protecting something high-value. No self-service PIN reset: a
  -- forgotten PIN goes through George by email, same as every other
  -- correction on this site.
  pin_hash text not null check (pin_hash ~ '^[0-9a-f]{64}$'),

  -- 'active' unless George has banned this participant — see "Banning
  -- a participant" below. Only ever changed via the Supabase dashboard;
  -- the public API has no update access to this table at all.
  status text not null default 'active' check (status in ('active', 'banned')),
  banned_at timestamptz,
  ban_reason text,

  registered_at timestamptz not null default now(),

  -- A minor (under 18 at registration) must have the parental-consent
  -- box ticked. This is enforced here, not just in the front-end form,
  -- so it can't be bypassed by calling the API directly.
  constraint parental_consent_required_for_minors check (
    parental_consent = true or date_of_birth <= (current_date - interval '18 years')
  )
);

create index if not exists participants_status_idx on public.participants (status);

-- ---------------------------------------------------------------------
-- Row Level Security
-- This table holds real personal data (legal name, DOB, home address,
-- phone, email) — much more sensitive than anything else on the site.
-- The public/anon key can INSERT a new registration (that's the sign-up
-- form) but can never SELECT, UPDATE, or DELETE — so none of this data
-- is readable through the public API, only through the Supabase
-- dashboard (George, signed in as the project owner). This is stricter
-- than the `sightings` table (which allows public SELECT, since a
-- species/date/suburb isn't sensitive) — nothing here is ever meant to
-- be read back by the website.
-- ---------------------------------------------------------------------
alter table public.participants enable row level security;

drop policy if exists "public can register" on public.participants;
create policy "public can register"
  on public.participants for insert
  to anon
  with check (status = 'active');
  -- Blocks a registration from being inserted as anything other than
  -- 'active' — banning can only happen afterward, via the dashboard.

-- Deliberately no select/update/delete policy for `anon` — with RLS
-- enabled and no matching policy, those actions are refused outright.

-- ---------------------------------------------------------------------
-- Function: participant_status
-- Lets the site ask "is this name registered, and in good standing?"
-- without ever exposing the participant's actual data. Returns:
--   null      — no one has registered under this name
--   'active'  — registered and free to play
--   'banned'  — registered but banned (see "Banning a participant")
-- SECURITY DEFINER so it can read the participants table despite the
-- caller (anon) having no SELECT grant on it directly — the function
-- itself is the only thing allowed to peek, and it only ever returns a
-- single status word, never any of the participant's actual details.
-- ---------------------------------------------------------------------
create or replace function public.participant_status(key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status from public.participants where participant_key = lower(trim(key));
$$;

grant execute on function public.participant_status(text) to anon;

-- ---------------------------------------------------------------------
-- Function: submit_sighting
-- Replaces a direct `insert into sightings` from the client. Checks, in
-- one atomic call: the name is registered, the participant is active
-- (not banned), and the supplied PIN hash matches the one stored at
-- registration — only then inserts the sighting and returns the new
-- row. SECURITY DEFINER so it can read participants.pin_hash (which
-- anon has no SELECT grant on — see RLS above) to compare it, without
-- ever returning that hash or any other participant detail back to the
-- caller. Raises a plain exception (caught client-side) if any check
-- fails; the message distinguishes the cases the front end needs to
-- show a specific hint for.
-- ---------------------------------------------------------------------
create or replace function public.submit_sighting(
  p_name text,
  p_pin_hash text,
  p_species text,
  p_sighting_date date,
  p_location text,
  p_notes text
)
returns public.sightings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_name));
  v_participant public.participants;
  v_row public.sightings;
begin
  select * into v_participant from public.participants where participant_key = v_key;

  if v_participant is null then
    raise exception 'not_registered';
  end if;

  if v_participant.status <> 'active' then
    raise exception 'not_active';
  end if;

  if v_participant.pin_hash <> lower(trim(p_pin_hash)) then
    raise exception 'invalid_pin';
  end if;

  insert into public.sightings (participant_name, species, sighting_date, location, notes)
  values (p_name, p_species, p_sighting_date, p_location, p_notes)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.submit_sighting(text, text, text, date, text, text) to anon;

-- ---------------------------------------------------------------------
-- Sightings can now ONLY be inserted through submit_sighting() above —
-- direct inserts from the public API are blocked outright. This
-- replaces the original "public can insert sightings" policy from
-- schema.sql, which let anyone typing any name log a sighting with no
-- registration or PIN check at all. submit_sighting() is SECURITY
-- DEFINER, so it inserts as its owner (bypassing RLS) once its own
-- checks pass — there is deliberately no insert policy for `anon` here,
-- so a direct `.from('sightings').insert(...)` call now fails with no
-- matching policy, and the only path in is the vetted function.
-- ---------------------------------------------------------------------
drop policy if exists "public can insert sightings" on public.sightings;
drop policy if exists "registered active participants can insert sightings" on public.sightings;

-- ---------------------------------------------------------------------
-- Banning a participant (George, via the Supabase dashboard)
-- If a participant causes abuse or harm to other participants, or to
-- wildlife/nature, open Table Editor → participants, find their row,
-- and set:
--   status      = 'banned'
--   banned_at   = now (or leave — not required, just a record)
--   ban_reason  = a short note for your own records
-- This takes effect immediately: the policy above means they can no
-- longer log any new sightings under that name, on the live site or
-- anywhere else that uses the public API. It does NOT retroactively
-- remove sightings they already logged — if those need to come down
-- too (e.g. the abuse relates to a specific fabricated sighting),
-- delete those rows from `sightings` the same way. There's no
-- self-service "unban" from the public site either — reversing a ban
-- is the same dashboard edit, done manually.
