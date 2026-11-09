// Curiosity by Georgie — Brisbane Air 50: notify-consent-confirmed Edge Function
//
// Fired by a Supabase Database Webhook on UPDATE of public.consent_requests
// (see supabase/parent-consent-migration.sql) — confirmed_at flips from
// null to a timestamp exactly once, inside confirm_parent_consent(), the
// moment a parent/guardian completes the checklist on parent-consent.html.
// Only sends the email on that null → non-null transition, never on any
// other update to the row.
//
// Looks up the (now active) participant's display name and parent's name
// + email the same service-role way every other notification function on
// this site does, and sends the FINAL "you're all set" copy from
// Sprintlaw's Website Page Wording, Part E.4, delivered 2026-11-08 — do
// not reword it.
//
// Reuses the same RESEND_API_KEY secret and verified sending domain as
// send-pin-reset and notify-parent-consent — nothing new to set up in
// Resend. See the setup steps at the bottom of this file.
//
// NOTE: like notify-parent-consent/index.ts, this file did not previously
// exist in the repo — this is a second, new transactional email the
// parent-consent flow needs (Page Wording Part E.4) that had no backend
// at all until now, not a copy-only change to something already built.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const FROM_ADDRESS = "Curiosity by Georgie <noreply@curiositybygeorgie.au>";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = payload.record ?? payload.new ?? payload;
    const oldRow = payload.old_record ?? payload.old ?? null;
    const participantKey = row?.participant_key;

    // Only act on the null → non-null transition, so this never fires
    // again on some later, unrelated update to the same row.
    if (!row?.confirmed_at || (oldRow && oldRow.confirmed_at)) {
      return json({ skipped: "not a new confirmation" });
    }
    if (!participantKey) {
      return json({ skipped: "no participant_key in payload" });
    }

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

    if (!participant || !participant.parent_email) {
      return json({ skipped: "participant not found or no parent email" });
    }

    const sent = await sendConsentConfirmedEmail({
      to: participant.parent_email,
      parentName: participant.parent_name,
      displayName: participant.display_name,
    });

    return json({ ok: true, emailed: sent });
  } catch (err) {
    console.error("notify-consent-confirmed failed:", err);
    return json({ ok: false, error: String(err) });
  }
});

async function sendConsentConfirmedEmail(details: {
  to: string;
  parentName: string;
  displayName: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("notify-consent-confirmed: RESEND_API_KEY not set, skipping");
    return false;
  }
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
        subject: `Thanks, ${details.displayName} is ready to start the Brisbane Air 50`,
        html:
          `<p>Hi ${parentName},</p>` +
          `<p>Thanks for confirming your consent. ${displayName}'s registration is now active and they ` +
          `can start logging sightings.</p>` +
          `<p>A quick reminder that safety comes first: please make sure ${displayName} follows the safety ` +
          `rules, never approaches or touches a sick or dead bird, and, while under 16, is accompanied by ` +
          `you or another responsible adult you approve when outdoors.</p>` +
          `<p>You can withdraw your consent, or ask to see, correct or delete your child's information, at ` +
          `any time by replying to this email or contacting us at curiositybygeorgie.au/contact. Our ` +
          `Privacy Policy explains how we handle your information.</p>` +
          `<p>Thanks,<br>Georgie<br>Curiosity by Georgie | George Logan | curiositybygeorgie.au</p>`,
      }),
    });
    if (!resp.ok) {
      console.error("notify-consent-confirmed: Resend send failed:", resp.status, await resp.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("notify-consent-confirmed: Resend send failed:", err);
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
// 1. Deploy this function:
//      Dashboard → Edge Functions → Deploy a new function → name it
//      "notify-consent-confirmed" → paste this file's contents in.
//    Reuses the same RESEND_API_KEY secret as every other notification
//    function here — nothing new to add.
//
// 2. Wire it up:
//      Dashboard → Database → Webhooks → Create a new hook
//        Table: consent_requests   Events: Update   Type: Supabase Edge Functions
//        Edge Function: notify-consent-confirmed
//    (A second webhook on the same table notify-parent-consent uses —
//    that one's on Insert, this one's on Update. Both can exist side by
//    side on consent_requests without conflicting.)
//
// To test without a real parent confirming: SQL Editor, using a token
// from an actual pending consent_requests row →
//   select confirm_parent_consent('<that token>', '{}'::jsonb);
// — fires this webhook the same way parent-consent.html's submit does.
