-- Curiosity by Georgie — Brisbane Air 50: actually close the PIN-lockout
-- bypass + trigger-function exposure (v1.0, supersedes the incomplete fix)
--
-- Found 2026-11-11: check-pin-lockdown-migration.sql and trigger-function-
-- lockdown-migration.sql both ran successfully, but a follow-up check of
-- information_schema.routine_privileges showed check_pin(),
-- assign_founding_flock_rank(), and assign_registration_number() all
-- still had EXECUTE granted to PUBLIC.
--
-- In Postgres, every role — including anon and authenticated — is
-- automatically a member of the PUBLIC pseudo-role. A function gets
-- EXECUTE granted to PUBLIC by default the moment it's created, unless
-- that's explicitly revoked. Revoking EXECUTE from anon/authenticated BY
-- NAME (what the two earlier migrations did) has no real effect as long
-- as PUBLIC itself still holds the grant — anon and authenticated keep
-- executing the function through their PUBLIC membership regardless.
--
-- This is the actual fix: revoke from PUBLIC directly. Re-running the
-- anon/authenticated revokes alongside it is harmless but no longer
-- doing any of the real work.
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Safe to re-run. Run this one ASAP — check_pin's
-- PIN-lockout bypass is the real security issue and is still open until
-- this runs.

revoke execute on function public.check_pin(public.participants, text) from public;
revoke execute on function public.assign_founding_flock_rank() from public;
revoke execute on function public.assign_registration_number() from public;

-- Belt-and-braces: keep the earlier, redundant-but-harmless revokes too,
-- in case this is ever run on a database where the anon/authenticated
-- migration was skipped.
revoke execute on function public.check_pin(public.participants, text) from anon, authenticated;
revoke execute on function public.assign_founding_flock_rank() from anon, authenticated;
revoke execute on function public.assign_registration_number() from anon, authenticated;
