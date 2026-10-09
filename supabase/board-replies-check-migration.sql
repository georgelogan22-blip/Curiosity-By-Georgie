-- Curiously Georgie — Brisbane Air 50: "Check my replies" (v1.0)
--
-- The community board (chat.html) has no notification system — if you
-- comment on someone else's post, they aren't emailed or alerted in any
-- way; they'd only find out by browsing back to the board. Real email
-- notifications need a verified custom domain in Resend (the shared
-- onboarding@resend.dev sender can only deliver to George's own inbox —
-- see supabase/functions/verify-sighting/index.ts); curiositybygeorgie.au
-- is registered and active (confirmed 2026-10-09) but not yet verified as
-- a Resend sending domain. This migration adds an in-app alternative
-- instead, so that part isn't a blocker either way: a participant
-- can self-check whether anyone has replied to their own posts since
-- they last looked, using the same name + PIN they already use to post
-- and comment — no email, no domain needed.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — everything
-- here uses `if not exists` / `create or replace`. Run this AFTER
-- schema.sql, registration-migration.sql, and
-- community-board-migration.sql (it relies on public.participants,
-- public.board_posts, and public.board_comments all existing already).

-- ---------------------------------------------------------------------
-- Column: participants.board_replies_checked_at
-- Tracks the last time this participant ran the "check my replies"
-- action. Null means "never checked" — check_board_replies() below
-- falls back to the participant's own registered_at in that case, so a
-- brand-new participant doesn't get flooded with every reply ever left
-- on the board before they signed up.
-- ---------------------------------------------------------------------
alter table public.participants
  add column if not exists board_replies_checked_at timestamptz;

-- ---------------------------------------------------------------------
-- Function: check_board_replies
-- Same registration/PIN check as participant_sightings() (no
-- active-status check — a banned participant can still look back at
-- replies they already received). Returns every comment left on any of
-- this participant's own posts since their last check, newest first,
-- excluding the participant's own comments on their own posts (replying
-- to yourself isn't a "new reply" notification). As a side effect,
-- stamps board_replies_checked_at = now() on this participant's row, so
-- the next check only shows what's new since *this* one — the same
-- "mark as read on open" behaviour as any inbox.
-- ---------------------------------------------------------------------
create or replace function public.check_board_replies(
  p_name text,
  p_pin_hash text
)
returns table (
  comment_id uuid,
  post_id uuid,
  post_caption text,
  commenter_name text,
  comment_body text,
  commented_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_name));
  v_participant public.participants;
  v_since timestamptz;
begin
  select * into v_participant from public.participants where participant_key = v_key;

  if v_participant is null then
    raise exception 'not_registered';
  end if;

  if v_participant.pin_hash <> lower(trim(p_pin_hash)) then
    raise exception 'invalid_pin';
  end if;

  v_since := coalesce(v_participant.board_replies_checked_at, v_participant.registered_at);

  update public.participants
  set board_replies_checked_at = now()
  where participant_key = v_key;

  return query
  select
    c.id as comment_id,
    c.post_id,
    p.caption as post_caption,
    c.participant_name as commenter_name,
    c.body as comment_body,
    c.created_at as commented_at
  from public.board_comments c
  join public.board_posts p on p.id = c.post_id
  where p.participant_key = v_key
    and c.participant_key <> v_key
    and c.created_at > v_since
  order by c.created_at desc;
end;
$$;

grant execute on function public.check_board_replies(text, text) to anon;
