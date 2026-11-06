-- Curiosity by Georgie — Brisbane Air 50: parent/guardian consent flow
-- + registration address removal (v2.0, reconstructed 2026-11-06)
--
-- This is the file README-START-HERE.md has referenced all along as
-- "supabase/parent-consent-migration.sql" — it was originally only ever
-- pasted directly into the Supabase SQL Editor and never saved back
-- into the repo, so this is the first time it's actually existed here.
-- register_participant(), confirm_parent_consent(), and
-- resend_parent_consent() below were copied out of the live Supabase
-- dashboard on 2026-11-06, with one real change: register_participant()
-- has been updated to drop address/suburb/state/postcode, per the
-- 2026-11-06 Sprintlaw call decision to stop collecting a residential
-- address at registration (a postal address will be requested
-- separately, later, only from the actual first-fifty finishers).
--
-- The consent_requests table and the extra participants columns
-- (parent_name, parent_email, parent_relationship, consent_checks,
-- consent_confirmed_at, and 'pending_consent' as a valid status) are
-- NOT included here — they already exist live and this migration was
-- written without a verified copy of their original CREATE TABLE/ALTER
-- TABLE statements, so nothing here touches them. If this ever needs
-- rebuilding from scratch (a new Supabase project, a preview branch),
-- check Table Editor first and add that schema before running this.
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Safe to re-run — DROP NOT NULL is a no-op if
-- already nullable, and every function replace is idempotent.
--
-- Already run once in production on 2026-11-06 (confirmed success).

-- ---------------------------------------------------------------------
-- 1. Make the address columns nullable.
-- They stay on the table (so a later "ask the finisher for a postal
-- address" flow can UPDATE them for just the first fifty, without a
-- schema change) but registration no longer requires them. The
-- non-empty-string check constraints on each column are left in place
-- deliberately — a NULL always satisfies a check constraint in
-- Postgres, so they still do their job (reject a blank string) for
-- whatever later process eventually fills these in.
-- ---------------------------------------------------------------------
alter table public.participants alter column address_line drop not null;
alter table public.participants alter column suburb drop not null;
alter table public.participants alter column state drop not null;
alter table public.participants alter column postcode drop not null;

-- ---------------------------------------------------------------------
-- 2. Replace register_participant() with a 9-parameter version.
-- Postgres can't drop a single parameter from an existing function —
-- it has to be dropped and recreated. Explicitly drops the old
-- 13-parameter signature (the one register.js used to call) first, so
-- there's no stale overload left behind for PostgREST to get confused
-- by.
-- ---------------------------------------------------------------------
drop function if exists public.register_participant(
  text, text, date, text, text, text, text, text, text, text, text, text, text
);

create or replace function public.register_participant(
  p_display_name text,
  p_full_legal_name text,
  p_date_of_birth date,
  p_phone text,
  p_email text,
  p_pin_hash text,
  p_parent_name text,
  p_parent_email text,
  p_parent_relationship text
)
returns table(status text, consent_pending boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_minor boolean;
  v_status text;
  v_key text := lower(trim(p_display_name));
  v_token text;
begin
  v_is_minor := p_date_of_birth > (current_date - interval '18 years');

  if v_is_minor then
    if p_parent_name is null or char_length(trim(p_parent_name)) = 0 then
      raise exception 'parent_name_required';
    end if;
    if p_parent_email is null or char_length(trim(p_parent_email)) = 0 then
      raise exception 'parent_email_required';
    end if;
    v_status := 'pending_consent';
  else
    v_status := 'active';
  end if;

  insert into public.participants (
    display_name, full_legal_name, date_of_birth,
    phone, email, pin_hash, parental_consent, parent_name, parent_email, parent_relationship, status
  ) values (
    p_display_name, p_full_legal_name, p_date_of_birth,
    p_phone, p_email, p_pin_hash, false,
    case when v_is_minor then trim(p_parent_name) else null end,
    case when v_is_minor then trim(p_parent_email) else null end,
    case when v_is_minor then p_parent_relationship else null end,
    v_status
  );

  if v_is_minor then
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.consent_requests (participant_key, token, expires_at)
    values (v_key, v_token, now() + interval '7 days');
  end if;

  return query select v_status, v_is_minor;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Lock it down again, deliberately.
-- Dropping and recreating register_participant() above reset its
-- permissions. Confirmed live on 2026-11-06 that `anon` (and
-- `authenticated`) had EXECUTE on the old signature — this project's
-- Supabase instance auto-grants EXECUTE on every new public-schema
-- function directly to anon/authenticated/service_role, which is a
-- Supabase-level default, NOT the Postgres "PUBLIC" pseudo-role — so
-- `revoke ... from public` (an earlier, buggy version of this
-- migration) does nothing to it. Has to explicitly name anon and
-- authenticated. service_role and postgres are left untouched — they
-- aren't reachable from the public website anyway. Confirmed via
-- information_schema.role_routine_grants that this actually removes
-- anon's access (the first version of this fix did not).
--
-- When registration is actually meant to go live for real, run:
--   grant execute on function public.register_participant(text, text, date, text, text, text, text, text, text) to anon;
-- ---------------------------------------------------------------------
revoke execute on function public.register_participant(
  text, text, date, text, text, text, text, text, text
) from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Re-save confirm_parent_consent() and resend_parent_consent()
-- as-is — no logic change, just finally getting them into the repo.
-- Signatures are unchanged from what's already live, so `create or
-- replace` here does NOT touch their existing grants.
-- ---------------------------------------------------------------------
create or replace function public.confirm_parent_consent(
  p_token text,
  p_checks jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consent_requests;
begin
  select * into v_row from public.consent_requests where token = trim(p_token);

  if v_row is null then
    raise exception 'invalid_token';
  end if;
  if v_row.confirmed_at is not null then
    raise exception 'token_used';
  end if;
  if v_row.expires_at < now() then
    raise exception 'token_expired';
  end if;

  update public.participants
  set parental_consent = true,
      consent_checks = p_checks,
      consent_confirmed_at = now(),
      status = 'active'
  where participant_key = v_row.participant_key;

  update public.consent_requests set confirmed_at = now() where id = v_row.id;
end;
$$;

create or replace function public.resend_parent_consent(
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_display_name));
  v_status text;
  v_token text;
begin
  select status into v_status from public.participants where participant_key = v_key;

  if v_status = 'pending_consent' then
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.consent_requests (participant_key, token, expires_at)
    values (v_key, v_token, now() + interval '7 days');
  end if;
end;
$$;
