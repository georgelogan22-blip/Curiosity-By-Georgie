-- Curiously Georgie — Brisbane Air 50: Photo verification migration (v1.0)
--
-- Adds photo evidence to sighting submissions, plus the plumbing for an
-- automated first-pass review: a Storage bucket to hold the photos, new
-- columns on `sightings` to record what the automated check found, and
-- an updated submit_sighting() that requires a photo and always inserts
-- as 'pending' (auto-confirmation now happens afterward, via the
-- verify-sighting Edge Function — see supabase/functions/verify-sighting
-- — not inside this database function).
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — everything
-- here uses `if not exists` / `or replace` / `drop ... if exists`.
-- Run this AFTER schema.sql, points-migration.sql, and
-- registration-migration.sql.
--
-- This migration only covers the database side. Two more steps finish
-- the feature, both one-time, both done in the Supabase dashboard (not
-- SQL) — see the README at the bottom of supabase/functions/verify-sighting
-- for the exact steps: (1) deploy that Edge Function and add your own
-- ANTHROPIC_API_KEY as a secret, (2) add a Database Webhook so new
-- sightings actually trigger it.

-- ---------------------------------------------------------------------
-- Storage bucket: sighting-photos
-- Public read (these are just wildlife photos, nothing sensitive — and a
-- public URL means Georgie can open a pending photo straight from the
-- SQL Editor or Table Editor with a click, no signed-URL dance). Anyone
-- can upload (that's the sighting form); no one can update or delete a
-- photo once it's up, including its own uploader — matches the
-- "sightings are a permanent record" posture of the rest of the site.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('sighting-photos', 'sighting-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can upload sighting photos" on storage.objects;
create policy "public can upload sighting photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'sighting-photos');

drop policy if exists "public can view sighting photos" on storage.objects;
create policy "public can view sighting photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'sighting-photos');

-- ---------------------------------------------------------------------
-- sightings: photo + automated-review columns
-- photo_path is the object path inside the sighting-photos bucket (not a
-- full URL — the site builds the URL from this + the bucket being
-- public). photo_taken_at is the date read from the photo's own EXIF
-- metadata client-side, before upload — this is what gets checked
-- against the challenge's launch date, since it can't be faked by just
-- changing the "Date seen" field in the form. review_confidence /
-- review_notes / reviewed_at record what the automated check (or
-- Georgie, on manual review) found — mainly so a "pending" row is a
-- five-second glance in the dashboard, not a mystery.
-- ---------------------------------------------------------------------
alter table public.sightings
  add column if not exists photo_path text,
  add column if not exists photo_taken_at date,
  add column if not exists review_confidence text check (review_confidence in ('high', 'medium', 'low')),
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz;

-- New sightings now start pending by default — up to now the column
-- defaulted to 'confirmed' since there was no review step yet (see the
-- comment in schema.sql). From here on, the verify-sighting Edge
-- Function (or Georgie, manually) is what confirms a sighting.
alter table public.sightings alter column status set default 'pending';

-- ---------------------------------------------------------------------
-- Function: submit_sighting (replaces the 6-argument version from
-- registration-migration.sql)
-- Same registration/active/PIN checks as before, plus: a photo is now
-- required (raises 'photo_required' if missing), and every row is
-- inserted as 'pending' regardless of anything else — auto-confirmation
-- is deliberately NOT done here, so it can be handled by the Edge
-- Function calling out to a vision model, which plain SQL can't do.
-- ---------------------------------------------------------------------
create or replace function public.submit_sighting(
  p_name text,
  p_pin_hash text,
  p_species text,
  p_sighting_date date,
  p_location text,
  p_notes text,
  p_photo_path text,
  p_photo_taken_at date
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

  if p_photo_path is null or char_length(trim(p_photo_path)) = 0 then
    raise exception 'photo_required';
  end if;

  insert into public.sightings (
    participant_name, species, sighting_date, location, notes,
    photo_path, photo_taken_at, status
  )
  values (
    p_name, p_species, p_sighting_date, p_location, p_notes,
    p_photo_path, p_photo_taken_at, 'pending'
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.submit_sighting(text, text, text, date, text, text, text, date) to anon;

-- Drop the old 6-argument version now that a photo is required — keeping
-- both around would let any not-yet-updated front-end code skip the
-- photo step entirely.
drop function if exists public.submit_sighting(text, text, text, date, text, text);

-- ---------------------------------------------------------------------
-- View: pending_sightings_review
-- Georgie's manual review queue — every sighting still waiting on a
-- decision, oldest first, with a direct clickable link to the photo and
-- whatever the automated check already found. Query it in the SQL
-- Editor:
--   select * from public.pending_sightings_review;
-- To confirm or reject a row: Table Editor → sightings → find it by id
-- → set status to 'confirmed' or 'rejected' (same as before this
-- migration — this view is just a nicer way to see what's waiting).
-- Deliberately NOT granted to `anon` — like `participants`, this can
-- surface a submission's details before it's public, so it's
-- dashboard-only (project owner), same access level as participants.
-- ---------------------------------------------------------------------
create or replace view public.pending_sightings_review as
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
  case when photo_path is not null
    then 'https://nduhuiihmagptvrxgkhk.supabase.co/storage/v1/object/public/sighting-photos/' || photo_path
    else null
  end as photo_url,
  created_at
from public.sightings
where status = 'pending'
order by created_at asc;
