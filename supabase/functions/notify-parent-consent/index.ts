// Curiosity by Georgie — Brisbane Air 50: notify-parent-consent Edge Function
//
// Fired by a Supabase Database Webhook on INSERT into public.consent_requests
// (see supabase/parent-consent-migration.sql) — a row lands there the moment
// a Minor registers (register_participant()) or a pending registration's
// consent email is re-sent (resend_parent_consent()).
//
// This function's one job: look up the Minor's display name and their
// parent/guardian's name + email (service-role key only — anon has no
// SELECT on participants at all, same as send-pin-reset and verify-
// sighting), and email the parent a link to parent-consent.html with their
// one-time token, via Resend. Copy is the FINAL wording from Sprintlaw's
// Website Page Wording, Part E.2, delivered 2026-11-08 — do not reword it.
//
// Reuses the same RESEND_API_KEY secret and verified sending domain as
// send-pin-reset — nothing new to set up in Resend if that one's already
// sending real emails. See the setup steps at the bottom of this file.
//
// NOTE: this file did not previously exist in the repo. Per README-
// START-HERE.md step 3, it was always meant to be deployed by pasting its
// contents directly into the Supabase dashboard (same as parent-consent-
// migration.sql originally was) — so if a notify-parent-consent function
// is already live with placeholder copy, it was never saved back here.
// This is now the one copy of record; redeploy from this file.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Same site URL / sending domain as send-pin-reset — see that file's own
// comments for the DNS/verification steps behind FROM_ADDRESS.
const SITE_URL = "https://curiositybygeorgie.au";
const FROM_ADDRESS = "Curiosity by Georgie <noreply@curiositybygeorgie.au>";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Supabase Database Webhooks send { type, table, record, old_record }
    // for a plain HTTP-request webhook; support a bare row too, in case
    // this is ever called directly for testing.
    const row = payload.record ?? payload.new ?? payload;
    const requestId = row.id;
    const participantKey = row.participant_key;
    const token = row.token;

    if (!participantKey || !token) {
      return json({ skipped: "no consent request row in payload" });
    }

    // anon has no SELECT on participants — service-role key only, same
    // pattern as send-pin-reset's own lookup.
    const lookupResp = await fetch(
      `${SUPABASE_URL}/rest/v1/participants?participant_key=eq.${encodeURIComponent(participantKey)}&select=display_name,parent_name,parent_email,status`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    const rows = await lookupResp.json();
    const participant = Array.isArray(rows) ? rows[0] : null;

    if (!participant || participant.status !== "pending_consent" || !participant.parent_email) {
      // Shouldn't happen — a consent_requests row is only ever inserted
      // for a minor awaiting consent — but bail out quietly rather than
      // email the wrong person if something changed in the moment.
      return json({ skipped: "participant not found, not pending, or no parent email" });
    }

    const sent = await sendConsentRequestEmail({
      to: participant.parent_email,
      parentName: participant.parent_name,
      displayName: participant.display_name,
      token,
    });

    return json({ ok: true, emailed: sent, requestId });
  } catch (err) {
    console.error("notify-parent-consent failed:", err);
    return json({ ok: false, error: String(err) });
  }
});

async function sendConsentRequestEmail(details: {
  to: string;
  parentName: string;
  displayName: string;
  token: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("notify-parent-consent: RESEND_API_KEY not set, skipping");
    return false;
  }
  const confirmUrl = `${SITE_URL}/parent-consent.html?token=${encodeURIComponent(details.token)}`;
  const displayName = escapeHtml(details.displayName);
  const parentName = escapeHtml(details.parentName || "there");
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
        subject: `Please confirm ${details.displayName}'s registration for the Brisbane Air 50`,
        html:
          `<p>Hi ${parentName},</p>` +
          `<p>${displayName} has registered to take part in the Brisbane Air 50, a free citizen birding ` +
          `challenge run by Curiosity by Georgie. Participants spot and photograph wild birds around ` +
          `Greater Brisbane and log their sightings on our website.</p>` +
          `<p>Because ${displayName} is under 18, we need your consent before they can take part. The ` +
          `challenge takes place outdoors, and there are some risks involved. Please read the information ` +
          `at the link below, together with our Website Terms and Challenge Rules and Privacy Policy, ` +
          `before deciding.</p>` +
          `<p><a href="${confirmUrl}">Review and confirm consent</a></p>` +
          `<p>If you don't confirm within 7 days, we'll cancel the registration and delete the information ` +
          `we've collected. If you didn't expect this email, or you don't consent, you don't need to do ` +
          `anything, but you can let us know by replying to this email.</p>` +
          `<p>Thanks,<br>Georgie<br>Curiosity by Georgie | George Logan | curiositybygeorgie.au</p>`,
      }),
    });
    if (!resp.ok) {
      console.error("notify-parent-consent: Resend send failed:", resp.status, await resp.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("notify-parent-consent: Resend send failed:", err);
    return false;
  }
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
// 1. Run supabase/parent-consent-migration.sql first (SQL Editor), if you
//    haven't already (confirmed already run in production on 2026-11-06).
//
// 2. Resend sending domain — already verified for send-pin-reset
//    (curiositybygeorgie.au). Nothing new to do here; this function reuses
//    the same RESEND_API_KEY secret and FROM_ADDRESS.
//
// 3. Deploy this function:
//      Dashboard → Edge Functions → Deploy a new function → name it
//      "notify-parent-consent" → paste this file's contents in. If a
//      function with this name already exists with placeholder copy,
//      replace its contents with this file's instead — it was never
//      saved back into the repo until now.
//
// 4. Wire it up:
//      Dashboard → Database → Webhooks → Create a new hook
//        Table: consent_requests   Events: Insert   Type: Supabase Edge Functions
//        Edge Function: notify-parent-consent
//
// To test without a real minor registration: SQL Editor →
//   select resend_parent_consent('<a real pending_consent display name>');
// — inserts a fresh consent_requests row, firing the webhook the same way.
