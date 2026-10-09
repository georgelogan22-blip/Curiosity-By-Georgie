-- Curiously Georgie — Brisbane Air 50: Community Board migration (v1.0)
--
-- Adds the "Chat" / Community Board feature: registered participants can
-- post a photo + caption (or just text — a photo is optional), and any
-- registered participant can comment on any post. Anyone — registered or
-- not — can browse the board itself, same as the Leaderboard and Hall of
-- Fame; only posting and commenting require registration (checked the
-- same way as logging a sighting: display name + the 4-digit PIN chosen
-- at registration, via a security-definer function, never a direct
-- insert policy).
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — everything
-- here uses `if not exists` / `or replace` / `drop ... if exists`.
-- Run this AFTER schema.sql, points-migration.sql, and
-- registration-migration.sql (it relies on public.participants and
-- participant_status() existing already).
--
-- Moderation: deliberately manual-only for now, same posture as banning
-- a participant — George deletes an inappropriate post/comment directly
-- via the Supabase dashboard (Table Editor → board_posts / board_comments
-- → delete row; deleting a post cascades to delete its comments too).
-- There's no in-app report/flag button and no self-delete/self-edit for
-- participants — matches the "sightings are a permanent record" posture
-- already used for sighting-photos.

-- ---------------------------------------------------------------------
-- Storage bucket: board-photos
-- Public read (so a post's photo is visible to anyone browsing the
-- board, same as sighting photos). Anyone can upload (the compose
-- form) — but note the actual POST row only gets created via
-- create_board_post() below, which checks registration/PIN; uploading a
-- photo on its own doesn't publish anything. No one can update or
-- delete a photo once it's up, including its own uploader.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('board-photos', 'board-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can upload board photos" on storage.objects;
create policy "public can upload board photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'board-photos');

drop policy if exists "public can view board photos" on storage.objects;
create policy "public can view board photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'board-photos');

-- ---------------------------------------------------------------------
-- Table: board_posts
-- participant_name is stored denormalised (like sightings.participant_name)
-- so the feed can render without a join. photo_path is the object path
-- inside the board-photos bucket (not a full URL), nullable — a post can
-- be caption-only. caption is required (every post needs at least some
-- text, even a photo-only sighting should say what it is).
-- ---------------------------------------------------------------------
create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  participant_name text not null,
  participant_key text generated always as (lower(trim(participant_name))) stored,
  caption text not null check (char_length(trim(caption)) > 0),
  photo_path text,
  created_at timestamptz not null default now()
);

create index if not exists board_posts_created_at_idx on public.board_posts (created_at desc);

alter table public.board_posts enable row level security;

drop policy if exists "public can read board posts" on public.board_posts;
create policy "public can read board posts"
  on public.board_posts for select
  to anon
  using (true);

-- No direct insert/update/delete policy for anon — every post is
-- created via create_board_post() (security definer, checks PIN),
-- and removal is dashboard-only (project owner), same as sightings.

-- Explicit Data API grant — Supabase stops auto-granting this for new
-- tables from 2026-10-30 (see their announcement email); this table
-- only worked without it because it predates that cutoff. Select only,
-- matching the RLS policy above — assets/supabase-client.js reads the
-- board feed with a direct `.from("board_posts").select(...)`, while
-- writes go through create_board_post() instead.
grant select on public.board_posts to anon;

-- ---------------------------------------------------------------------
-- Table: board_comments
-- Same participant_name/participant_key denormalisation as board_posts.
-- Deleting a post deletes its comments too (on delete cascade) so a
-- moderated-away post doesn't leave orphaned comments behind.
-- ---------------------------------------------------------------------
create table if not exists public.board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts (id) on delete cascade,
  participant_name text not null,
  participant_key text generated always as (lower(trim(participant_name))) stored,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists board_comments_post_id_idx on public.board_comments (post_id, created_at asc);

alter table public.board_comments enable row level security;

drop policy if exists "public can read board comments" on public.board_comments;
create policy "public can read board comments"
  on public.board_comments for select
  to anon
  using (true);

-- Explicit Data API grant — same reasoning as board_posts above. Select
-- only; comments are created via create_board_comment(), not a direct
-- insert.
grant select on public.board_comments to anon;

-- ---------------------------------------------------------------------
-- Function: create_board_post
-- Same registration/active/PIN checks as submit_sighting(). Returns the
-- new row (board_posts has a public SELECT policy, unlike participants,
-- so RETURNING works fine here).
-- ---------------------------------------------------------------------
create or replace function public.create_board_post(
  p_name text,
  p_pin_hash text,
  p_caption text,
  p_photo_path text
)
returns public.board_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_name));
  v_participant public.participants;
  v_row public.board_posts;
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

  if p_caption is null or char_length(trim(p_caption)) = 0 then
    raise exception 'caption_required';
  end if;

  insert into public.board_posts (participant_name, caption, photo_path)
  values (p_name, p_caption, p_photo_path)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_board_post(text, text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Function: create_board_comment
-- Same checks, plus confirms the target post still exists (it may have
-- been moderated away between page load and submit).
-- ---------------------------------------------------------------------
create or replace function public.create_board_comment(
  p_post_id uuid,
  p_name text,
  p_pin_hash text,
  p_body text
)
returns public.board_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_name));
  v_participant public.participants;
  v_row public.board_comments;
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

  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'body_required';
  end if;

  if not exists (select 1 from public.board_posts where id = p_post_id) then
    raise exception 'post_not_found';
  end if;

  insert into public.board_comments (post_id, participant_name, body)
  values (p_post_id, p_name, p_body)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_board_comment(uuid, text, text, text) to anon;
