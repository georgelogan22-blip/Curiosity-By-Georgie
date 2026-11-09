-- Curiosity by Georgie — Brisbane Air 50: lock down two trigger-only functions (v1.0)
--
-- Found 2026-11-09 going through Supabase's Security Advisor ("Function
-- Search Path Mutable"). public.assign_founding_flock_rank() and
-- public.assign_registration_number() are plain trigger functions (zero
-- arguments, not SECURITY DEFINER) meant to fire only as a side effect of
-- inserting into participants — nothing in assets/ ever calls either one
-- directly (confirmed via grep). Despite that, both were directly
-- callable by anon over the REST API, and neither had a search_path
-- pinned.
--
-- Not a live risk in practice (prosecdef=false, so calling either
-- outside its trigger context runs with the caller's own privileges, not
-- elevated ones, and both almost certainly reference NEW/OLD and simply
-- error out if invoked directly) — but there's no reason a pure trigger
-- function should be callable on its own at all, and pinning the search
-- path is free, standard practice. Tidying both up while already in this
-- file.
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Safe to re-run.

revoke execute on function public.assign_founding_flock_rank() from anon, authenticated;
revoke execute on function public.assign_registration_number() from anon, authenticated;

alter function public.assign_founding_flock_rank() set search_path = public;
alter function public.assign_registration_number() set search_path = public;

-- Triggers that call these still fire exactly as before — revoking EXECUTE
-- from anon/authenticated has no effect on a trigger invocation, which
-- always runs as the role performing the underlying table write, not
-- through the public RPC permission path these grants control.
