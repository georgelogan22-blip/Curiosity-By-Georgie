-- Curiosity by Georgie — Brisbane Air 50: retire the old Community Board
-- backend (v1.0)
--
-- chat.html (Curiosity Chat / "the community board") has been replaced
-- by the one-way Announcements Feed — see
-- supabase/announcements-feed-migration.sql and
-- claude/community-chat-removal-decision-2026-10-31.md. This migration
-- does NOT delete board_posts / board_comments / board_post_curious or
-- their data — it only removes every way the public could still write
-- to them, now that no page on the site calls these functions. Nothing
-- here is destructive; dropping the tables/data themselves would be a
-- separate, deliberate step if you ever want that.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run.

revoke execute on function public.create_board_post(text, text, text, text) from anon, public;
revoke execute on function public.create_board_comment(uuid, text, text, text) from anon, public;
revoke execute on function public.toggle_post_curious(uuid, text, text) from anon, public;
revoke execute on function public.check_board_replies(text, text) from anon, public;

-- delete_board_post() is referenced in assets/supabase-client.js's
-- comments (and was called from chat.js) but was never actually
-- committed as its own migration file — it only ever existed as
-- whatever got pasted into the dashboard directly, same situation a
-- few other functions on this project have been in. Guarded with a DO
-- block so this migration still runs cleanly whether or not that
-- function exists in your database, or exists with a different
-- signature.
do $$
begin
  execute 'revoke execute on function public.delete_board_post(uuid, text, text) from anon, public';
exception
  when undefined_function then
    raise notice 'delete_board_post(uuid, text, text) not found in this database — nothing to revoke, skipped.';
end $$;

-- Found while retiring this: the board-photos upload policy had no
-- registration check at all — literally anyone, registered participant
-- or not, could upload a file directly to this bucket, independent of
-- whether create_board_post() was ever called. That's closed off now,
-- and the bucket is flipped to private to match the same posture as
-- the sighting-photos lockdown (2026-11-11) — nothing reads a
-- board_posts photo publicly any more since chat.html is gone.
drop policy if exists "public can upload board photos" on storage.objects;
drop policy if exists "public can view board photos" on storage.objects;
update storage.buckets set public = false where id = 'board-photos';
