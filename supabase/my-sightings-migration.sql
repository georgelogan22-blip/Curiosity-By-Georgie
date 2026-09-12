-- Curiously Georgie — Brisbane Air 50: "My Sightings" status check (v1.0)
--
-- Lets a participant look up the status of their own logged sightings
-- (pending / confirmed / rejected) without exposing anyone else's data.
-- This is a PIN-gated, security-definer RPC — the same pattern as
-- submit_sighting() — rather than relying on the broad "public can read
-- sightings" select policy from schema.sql (which is still in force and
-- lets `anon` read every column of every row; this function doesn't
-- change that, it just gives the site a narrower, name+PIN-checked way
-- to fetch one participant's own rows for the new My Sightings page).
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — everything
-- here uses `create or replace`. Run this AFTER schema.sql,
-- registration-migration.sql, and photo-verification-migration.sql.

-- ---------------------------------------------------------------------
-- Function: participant_sightings
-- Verifies the display name is registered and the PIN matches (same
-- checks as submit_sighting, minus the active-status check — a banned
-- participant can still look back at sightings they already logged).
-- Returns that participant's own sightings, newest first, with the
-- automated/manual review outcome and a direct link to their own photo
-- (harmless to include — the sighting-photos bucket is already public
-- read, so this exposes nothing that wasn't already reachable by anyone
-- who knew the path).
-- ---------------------------------------------------------------------
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
    case when s.photo_path is not null
      then 'https://nduhuiihmagptvrxgkhk.supabase.co/storage/v1/object/public/sighting-photos/' || s.photo_path
      else null
    end as photo_url,
    s.created_at
  from public.sightings s
  where s.participant_key = v_key
  order by s.created_at desc;
end;
$$;

grant execute on function public.participant_sightings(text, text) to anon;
