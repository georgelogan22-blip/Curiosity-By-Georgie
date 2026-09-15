-- Curiously Georgie — Brisbane Air 50: self-service PIN reset (v1.0)
--
-- Adds an automated "forgot my PIN" flow so a forgotten PIN no longer has
-- to go through George by email every time (see registration-migration.sql's
-- original note on this). Because pin_hash is a one-way SHA-256 digest —
-- the raw PIN was never stored anywhere, by design — this can only ever be
-- a genuine RESET (choose a new PIN), never a RECOVERY (recall the old
-- one). That's the same trade-off every "forgot password" flow makes.
--
-- Requires a Resend sending domain to actually be useful: the existing
-- verify-sighting function emails only George himself via Resend's shared
-- onboarding@resend.dev sender, which Resend restricts to the account
-- owner's own address — it cannot deliver to an arbitrary participant.
-- Sending a real reset link to a participant's own registered email
-- needs a verified domain in Resend (a few DNS records at your registrar
-- — curiouslygeorgie.site works today, without waiting on the .au ID
-- check). See supabase/functions/send-pin-reset/index.ts for the rest of
-- the setup steps once that's done.
--
-- How to use: open your Supabase project → SQL Editor → New query, paste
-- this whole file, and click Run. Safe to re-run — everything here uses
-- `if not exists` / `or replace` / `drop ... if exists`. Run this AFTER
-- registration-migration.sql.

-- ---------------------------------------------------------------------
-- Table: pin_resets
-- One row per requested reset. The raw token lives here in plain text
-- (not hashed) — deliberately consistent with this project's existing,
-- documented stance on the PIN system itself (registration-migration.sql:
-- "a friction/deterrent measure, not bank-grade security"): this table is
-- never readable by the public API at all (see RLS below), only by the
-- SECURITY DEFINER functions further down and by the send-pin-reset Edge
-- Function (service role), so the same trust boundary already protecting
-- participants.pin_hash protects this token too. Each token is single-use
-- and short-lived (30 minutes).
-- ---------------------------------------------------------------------
create table if not exists public.pin_resets (
  id uuid primary key default gen_random_uuid(),
  participant_key text not null references public.participants(participant_key) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  emailed_at timestamptz
);

create index if not exists pin_resets_participant_idx on public.pin_resets (participant_key);
create index if not exists pin_resets_token_idx on public.pin_resets (token);

-- ---------------------------------------------------------------------
-- Row Level Security — no policies for `anon` at all. Every access goes
-- through a SECURITY DEFINER function below (which bypasses RLS the same
-- way participant_status()/submit_sighting() already do) or through the
-- send-pin-reset Edge Function's service-role key. With RLS enabled and
-- no matching policy, a direct anon SELECT/INSERT/UPDATE is refused.
-- ---------------------------------------------------------------------
alter table public.pin_resets enable row level security;

-- ---------------------------------------------------------------------
-- Function: request_pin_reset
-- Called when someone clicks "Forgot your PIN?" and enters their display
-- name. Always succeeds and returns nothing either way — deliberately
-- doesn't reveal whether that name is actually registered, so this can't
-- be used to enumerate participants. If the name IS registered and
-- active, it queues a reset row; inserting that row is what fires the
-- Database Webhook → send-pin-reset Edge Function (see that file) which
-- actually emails the link. If the name isn't registered, nothing is
-- queued and nothing is emailed — the front end shows the same "if that
-- name is registered, check your email" message regardless.
-- ---------------------------------------------------------------------
create or replace function public.request_pin_reset(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_display_name));
  v_active boolean;
  v_token text;
begin
  select (status = 'active') into v_active
  from public.participants
  where participant_key = v_key;

  if v_active then
    -- Two concatenated random UUIDs, dashes stripped — plenty of entropy
    -- for a token that's single-use and expires in 30 minutes; matches
    -- this table's own stated security posture above.
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.pin_resets (participant_key, token, expires_at)
    values (v_key, v_token, now() + interval '30 minutes');
  end if;
end;
$$;

grant execute on function public.request_pin_reset(text) to anon;

-- ---------------------------------------------------------------------
-- Function: redeem_pin_reset
-- Called from reset-pin.html once someone follows their emailed link and
-- chooses a new PIN. p_new_pin_hash is the SHA-256 hex digest computed
-- client-side (hashPin() in assets/supabase-client.js), same as every
-- other PIN write on this site — the raw new PIN is never sent here
-- either. Raises a plain exception (caught client-side, same pattern as
-- submit_sighting()) for each failure case the front end needs to show a
-- specific message for.
-- ---------------------------------------------------------------------
create or replace function public.redeem_pin_reset(p_token text, p_new_pin_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pin_resets;
begin
  if p_new_pin_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_pin';
  end if;

  select * into v_row from public.pin_resets where token = trim(p_token);
  if v_row is null then
    raise exception 'invalid_token';
  end if;
  if v_row.used_at is not null then
    raise exception 'token_used';
  end if;
  if v_row.expires_at < now() then
    raise exception 'token_expired';
  end if;

  update public.participants set pin_hash = p_new_pin_hash where participant_key = v_row.participant_key;
  update public.pin_resets set used_at = now() where id = v_row.id;
end;
$$;

grant execute on function public.redeem_pin_reset(text, text) to anon;

-- ---------------------------------------------------------------------
-- Remaining setup steps (do these after running this file):
--
-- 1. Verify a sending domain in Resend (Dashboard → Domains → Add
--    Domain → curiouslygeorgie.site), then add the DNS records it shows
--    you at VentraIP. Takes a few minutes to a few hours to verify.
-- 2. Deploy the send-pin-reset Edge Function — see the setup steps in
--    supabase/functions/send-pin-reset/index.ts (same process as
--    verify-sighting: Dashboard → Edge Functions → Deploy a new function
--    → Via Editor → paste in index.ts's contents → name it
--    "send-pin-reset").
-- 3. Create a Database Webhook — Dashboard → Integrations → Database
--    Webhooks → table `pin_resets`, event `Insert`, target the
--    `send-pin-reset` Edge Function. (Not the plain Database → Triggers
--    page — same distinction noted in photo-verification-migration.sql.)
--
-- Nothing above needs RESEND_API_KEY set again — it reuses the same
-- secret already added for verify-sighting.
-- ---------------------------------------------------------------------
