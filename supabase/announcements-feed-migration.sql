-- Curiosity by Georgie — Brisbane Air 50: Announcements Feed (v1.0)
--
-- Replaces the old two-way Curiosity Chat / Community Board with the
-- one-way Announcements Feed described in the FINAL Terms (clause 13,
-- "Announcements Feed, social media and Community Guidelines") and
-- decided 2026-10-31 — see
-- claude/community-chat-removal-decision-2026-10-31.md for the full
-- reasoning. Only George posts here (via the Supabase dashboard — see
-- below); the public can read but never post, comment, or react.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — everything
-- here uses `if not exists` / `create or replace` / `on conflict`.
--
-- To post a new announcement: Table Editor → announcements → Insert
-- row. Only `body` is required — `title` and `photo_path` are
-- optional. To feature a photo (e.g. "Photo of the Month"), first
-- upload the image in Storage → announcement-photos → Upload files,
-- then paste its filename into the new row's `photo_path` column.
-- Deleting/editing a row is the same dashboard-only moderation posture
-- used everywhere else on this site.

-- ---------------------------------------------------------------------
-- Table: announcements
-- No insert/update/delete policy for anon at all — unlike board_posts
-- before it, there is no security-definer "create" function either.
-- The only way a row gets created is George adding it directly in the
-- dashboard (which uses the service role and bypasses RLS entirely),
-- which is exactly the "only we can post" rule the Terms describe.
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text not null check (char_length(trim(body)) > 0),
  photo_path text,
  created_at timestamptz not null default now()
);

create index if not exists announcements_created_at_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;

drop policy if exists "public can read announcements" on public.announcements;
create policy "public can read announcements"
  on public.announcements for select
  to anon
  using (true);

-- Explicit Data API grant — Supabase stopped auto-granting this for new
-- tables from 2026-10-30 (see the comment on this same point in
-- supabase/community-board-migration.sql); this table is created after
-- that cutoff, so it needs the grant spelled out, or the public feed
-- query returns nothing despite the policy above looking correct.
grant select on public.announcements to anon;

-- ---------------------------------------------------------------------
-- Storage bucket: announcement-photos
-- Public read (same posture as avatar-photos/board-photos — a featured
-- photo is meant to be visible to anyone). Deliberately NO anon insert
-- policy: the only way a photo lands in this bucket is George uploading
-- it directly in the Storage browser (service role, bypasses RLS),
-- matching "only George can post" — there is no form anywhere on the
-- site that writes to this bucket.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('announcement-photos', 'announcement-photos', true)
on conflict (id) do update set public = excluded.public;
