-- Curiously Georgie — Brisbane Air 50: "Curious" reactions on board posts (v1.0)
--
-- George asked for an Instagram/Facebook-style "like" button on community
-- board posts, themed to the site: called "Curious" instead of "Like", with
-- a small magnifying-glass icon instead of a heart/thumbs-up. Gated by the
-- same name + PIN identity as posting/commenting, so one participant can
-- only register one Curious per post (not per browser/device) — clicking
-- again removes it, the same click-to-toggle behaviour as a real like
-- button.
--
-- How to use: open your Supabase project → SQL Editor → New query, paste
-- this whole file, and click Run. Safe to re-run — everything here uses
-- `if not exists` / `create or replace`. Run this AFTER schema.sql,
-- registration-migration.sql, and community-board-migration.sql (it
-- relies on public.participants and public.board_posts already existing).

create table if not exists public.board_post_curious (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts(id) on delete cascade,
  participant_key text not null references public.participants(participant_key),
  created_at timestamptz not null default now(),
  unique (post_id, participant_key)
);

alter table public.board_post_curious enable row level security;

-- Public can read (so counts are visible to everyone browsing the board,
-- same posture as board_posts/board_comments) but never insert/update/
-- delete directly — that only ever happens through toggle_post_curious()
-- below, which independently re-checks registration/active/PIN, same
-- pattern as every other write path on the site.
drop policy if exists "board_post_curious_select" on public.board_post_curious;
create policy "board_post_curious_select" on public.board_post_curious
  for select using (true);

-- Public read-only view of counts per post — lets the client get a
-- curious_count for every post in one query, without exposing exactly who
-- reacted (participant_key) on the raw table.
create or replace view public.board_curious_counts as
select post_id, count(*)::int as curious_count
from public.board_post_curious
group by post_id;

grant select on public.board_curious_counts to anon;

-- toggle_post_curious: same registration/active/PIN check as
-- create_board_comment(). If this participant hasn't marked this post
-- Curious yet, adds one and returns is_curious = true; if they already
-- have, removes it and returns is_curious = false — the click-to-toggle
-- behaviour a like button needs. Also returns the post's new total count
-- in the same round trip, so the client never has to make a second call
-- just to refresh the number.
create or replace function public.toggle_post_curious(
  p_post_id uuid,
  p_name text,
  p_pin_hash text
)
returns table (
  is_curious boolean,
  curious_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_name));
  v_participant public.participants;
  v_existing uuid;
  v_now_curious boolean;
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

  if not exists (select 1 from public.board_posts where id = p_post_id) then
    raise exception 'post_not_found';
  end if;

  select id into v_existing
  from public.board_post_curious
  where post_id = p_post_id and participant_key = v_key;

  if v_existing is null then
    insert into public.board_post_curious (post_id, participant_key) values (p_post_id, v_key);
    v_now_curious := true;
  else
    delete from public.board_post_curious where id = v_existing;
    v_now_curious := false;
  end if;

  return query
  select v_now_curious, (select count(*)::int from public.board_post_curious where post_id = p_post_id);
end;
$$;

grant execute on function public.toggle_post_curious(uuid, text, text) to anon;
