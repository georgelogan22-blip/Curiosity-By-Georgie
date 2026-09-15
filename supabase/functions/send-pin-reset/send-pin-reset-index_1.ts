// Curiously Georgie — Brisbane Air 50: send-pin-reset Edge Function
//
// Fired by a Supabase Database Webhook on INSERT into public.pin_resets
// (see supabase/pin-reset-migration.sql). A row only ever lands there when
// someone who's already registered clicks "Forgot your PIN?" and enters
// their display name — see request_pin_reset() in that migration for why
// a non-registered name never reaches this function at all.
//
// This function's one job: look up that participant's registered email
// (with the service-role key, which is the only thing on this site
// allowed to read participants.email at all — see registration-
// migration.sql's RLS notes) and send them a link to reset-pin.html with
// their one-time token, via Resend.
//
// Unlike verify-sighting's notification email (which only ever goes to
// George's own inbox, via Resend's shared onboarding@resend.dev sender),
// this one has to reach an arbitrary participant's real email address —
// Resend restricts that shared sender to the account owner's own address,
// so THIS function needs a verified sending domain in Resend first (a few
// DNS records at your registrar). See the setup steps at the bottom of
// this file.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// The site's public URL, used to build the reset link in the email.
// TODO: George — switch this to https://curiouslygeorgie.au once that
// domain is live and Pages is pointed at it; curiouslygeorgie.site is the
// right interim value for now (see site-plan-v0.1.md, "Remaining open
// questions," item 3).
const SITE_URL = "https://curiouslygeorgie.site";

// Must match a domain verified in your Resend account (Dashboard →
// Domains) — the shared onboarding@resend.dev sender verify-sighting uses
// CANNOT send to an arbitrary participant, only to the Resend account's
// own address. Once curiouslygeorgie.site (or whichever domain) is
// verified there, update this to match.
const FROM_ADDRESS = "Curiously Georgie <noreply@curiouslygeorgie.site>";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Supabase Database Webhooks send { type, table, record, old_record }
    // for a plain HTTP-request webhook; support a bare row too, in case
    // this is ever called directly for testing.
    const row = payload.record ?? payload.new ?? payload;
    const resetId = row.id;
    const participantKey = row.participant_key;
    const token = row.token;

    if (!resetId || !participantKey || !token) {
      return json({ skipped: "no reset row in payload" });
    }

    // Look up the participant's registered email + display name — anon
    // has no SELECT grant on participants at all (see registration-
    // migration.sql), so this has to go through the service-role key,
    // the same way updateSighting() does in verify-sighting.
    const lookupResp = await fetch(
      `${SUPABASE_URL}/rest/v1/participants?participant_key=eq.${encodeURIComponent(participantKey)}&select=email,display_name,status`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    const rows = await lookupResp.json();
    const participant = Array.isArray(rows) ? rows[0] : null;

    if (!participant || participant.status !== "active") {
      // Shouldn't happen — request_pin_reset() only ever inserts for an
      // active participant — but bail out quietly rather than email no
      // one, if a status changed in the moment between the two.
      return json({ skipped: "participant not found or not active" });
    }

    const sent = await sendResetEmail({
      to: participant.email,
      displayName: participant.display_name,
      token,
    });

    if (sent) {
      await markEmailed(resetId);
    }

    return json({ ok: true, emailed: sent });
  } catch (err) {
    console.error("send-pin-reset failed:", err);
    return json({ ok: false, error: String(err) });
  }
});

async function sendResetEmail(details: {
  to: string;
  displayName: string;
  token: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("send-pin-reset: RESEND_API_KEY not set, skipping");
    return false;
  }
  const resetUrl = `${SITE_URL}/reset-pin.html?token=${encodeURIComponent(details.token)}`;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [details.to],
        subject: "Reset your Curiously Georgie PIN",
        html:
          `<p>Hi ${escapeHtml(details.displayName)},</p>` +
          `<p>Someone (hopefully you) asked to reset the PIN for your Brisbane Air 50 ` +
          `account. Click below to choose a new one — this link works once and expires ` +
          `in 30 minutes:</p>` +
          `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
          `<p>If you didn't ask for this, you can safely ignore this email — your PIN ` +
          `stays exactly as it was.</p>`,
      }),
    });
    if (!resp.ok) {
      console.error("send-pin-reset: Resend send failed:", resp.status, await resp.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("send-pin-reset: Resend send failed:", err);
    return false;
  }
}

async function markEmailed(resetId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/pin_resets?id=eq.${resetId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      prefer: "return=minimal",
    },
    body: JSON.stringify({ emailed_at: new Date().toISOString() }),
  });
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------
// One-time setup (Supabase dashboard — not SQL):
//
// 1. Run supabase/pin-reset-migration.sql first (SQL Editor).
//
// 2. Verify a sending domain in Resend — this is the step that's new
//    compared to verify-sighting, and it's yours to do (Claude can't sign
//    into third-party accounts or add DNS records on your behalf):
//      a. resend.com → Domains → Add Domain → curiouslygeorgie.site.
//      b. Resend shows you a handful of DNS records (SPF/DKIM, usually
//         TXT and CNAME entries) — add each one exactly as shown, at
//         VentraIP (Domain → DNS management for curiouslygeorgie.site).
//      c. Back in Resend, click "Verify" — can take anywhere from a few
//         minutes to a few hours for DNS to propagate.
//      d. Once verified, confirm FROM_ADDRESS above uses that domain
//         (already set to noreply@curiouslygeorgie.site) — change it if
//         you verify a different domain instead.
//
// 3. Deploy this function:
//      Dashboard → Edge Functions → Deploy a new function → name it
//      "send-pin-reset" → paste this file's contents in.
//    It reuses the same RESEND_API_KEY secret already added for
//    verify-sighting — nothing new to add there. SUPABASE_URL and
//    SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// 4. Wire it up to fire automatically on every reset request:
//      Dashboard → Database → Webhooks → Create a new hook
//        Table: pin_resets   Events: Insert   Type: Supabase Edge Functions
//        Edge Function: send-pin-reset
//
// 5. Once curiouslygeorgie.au replaces curiouslygeorgie.site as the live
//    domain, update SITE_URL and FROM_ADDRESS above and redeploy.
//
// To test without a real "forgot PIN" click: SQL Editor →
//   select request_pin_reset('<a real registered display name>');
// — the webhook fires the same way as a real request.
