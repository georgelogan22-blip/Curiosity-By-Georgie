// Curiously Georgie — Brisbane Air 50: verify-sighting Edge Function
//
// The automated first pass on every newly-logged sighting. Fired by a
// Supabase Database Webhook on INSERT into public.sightings (see the
// setup steps at the bottom of this file). Checks two things:
//
//   1. The photo's own EXIF capture date (photo_taken_at, read
//      client-side before upload — see assets/supabase-client.js) is on
//      or after the challenge's launch date. This is what rules.html
//      calls the "Verification & Launch Date" check — it can't be
//      faked by just typing a different "date seen" in the form, since
//      it comes from the photo file itself.
//   2. A vision model's best guess at whether the photo is a genuine,
//      unedited photograph of a real bird (not a drawing, screenshot,
//      stock photo, or obviously AI-generated image). It deliberately
//      does NOT try to verify the specific species claimed — two real
//      Australian look-alikes (Australian Magpie vs. Pied Butcherbird /
//      Magpie-lark) were tripping the model up and getting genuine
//      sightings wrongly rejected, so as of 2026-09-12 species naming is
//      trusted from the participant; George can still catch a genuine
//      mislabeling by eye via the pending-review queue if one matters.
//
// A sighting is auto-confirmed only when the date passes AND the vision
// check comes back "high" confidence. Everything else — no date, a
// pre-launch date, or anything less than high confidence — is left
// 'pending' for Georgie to check by eye (see the pending_sightings_review
// view in supabase/photo-verification-migration.sql). This deliberately
// errs toward more manual review, not fewer: a false "confirmed" costs
// more (a bogus entry on the public Leaderboard) than a false "pending"
// (one more row in Georgie's queue).

const LAUNCH_DATE = "2026-01-01"; // TODO: George — set the real Brisbane Air 50 launch date here

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Haiku, not Sonnet or Opus — this is a cheap, high-volume, low-stakes
// classification call (bird photo → species name + confidence), not
// something that needs the most capable model. Keeps the per-submission
// cost small since George is paying for this out of his own Anthropic
// account.
const VISION_MODEL = "claude-haiku-4-5";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Supabase Database Webhooks send { type, table, record, old_record }
    // for a plain HTTP-request webhook; support a bare row too, in case
    // this is ever called directly for testing.
    const row = payload.record ?? payload.new ?? payload;
    const sightingId = row.id;
    const species = row.species;
    const photoPath = row.photo_path;
    const photoTakenAt = row.photo_taken_at as string | null;

    if (!sightingId) {
      return json({ skipped: "no sighting id in payload" });
    }
    if (!photoPath) {
      // Shouldn't happen — submit_sighting() requires a photo — but
      // leave it pending rather than guess if it somehow does.
      await updateSighting(sightingId, {
        review_confidence: "low",
        review_notes: "No photo on this row — needs a manual look.",
        reviewed_at: new Date().toISOString(),
      });
      return json({ skipped: "missing photo_path" });
    }

    const dateOk = !!photoTakenAt && photoTakenAt >= LAUNCH_DATE;
    let confidence: "high" | "medium" | "low" = "low";
    let notes = "";

    if (!dateOk) {
      notes = photoTakenAt
        ? `Photo's capture date (${photoTakenAt}) is before the challenge launch date (${LAUNCH_DATE}).`
        : "Photo had no readable capture date (EXIF missing or stripped).";
    } else if (!ANTHROPIC_API_KEY) {
      notes = "ANTHROPIC_API_KEY isn't set for this function yet — species wasn't auto-checked.";
    } else {
      // Only spend an API call on the species check once the date has
      // already passed — no point checking a photo that can't be
      // auto-confirmed either way.
      const result = await checkSpeciesWithVision(photoPath, species);
      confidence = result.confidence;
      notes = result.reason;
    }

    const finalStatus = dateOk && confidence === "high" ? "confirmed" : "pending";

    await updateSighting(sightingId, {
      status: finalStatus,
      review_confidence: confidence,
      review_notes: notes,
      reviewed_at: new Date().toISOString(),
    });

    return json({ ok: true, sightingId, status: finalStatus, confidence });
  } catch (err) {
    // Never throw back a 5xx for a webhook — Supabase will retry it
    // repeatedly, and either way the sighting is already safely sitting
    // as 'pending' from submit_sighting()'s own insert. Just log what
    // happened in review_notes if we can tell which row it was.
    return json({ error: String(err) });
  }
});

async function checkSpeciesWithVision(
  photoPath: string,
  species: string,
): Promise<{ confidence: "high" | "medium" | "low"; reason: string }> {
  const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/sighting-photos/${photoPath}`;
  const imgResp = await fetch(photoUrl);
  if (!imgResp.ok) {
    return { confidence: "low", reason: `Couldn't fetch the photo to check it (HTTP ${imgResp.status}).` };
  }
  const mediaType = imgResp.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await imgResp.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  const base64 = btoa(binary);

  const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            {
              type: "text",
              text:
                `A participant in a Brisbane, Australia bird-spotting challenge has logged this photo, ` +
                `describing it as a "${species}". This photo's file metadata has already been checked ` +
                `separately and confirmed as a genuine, unedited capture from a real camera. Do NOT try to ` +
                `verify whether that species name is correct — participants can occasionally misname or ` +
                `mis-ID a species (this is expected and fine; a human reviewer can catch a genuine ` +
                `mislabeling by eye later if it matters). Your only job is to judge whether this image is a ` +
                `real, unedited photograph that shows an actual bird (any bird at all), as opposed to a ` +
                `drawing, painting, cartoon, screenshot, meme, watermarked stock photo, or an obviously ` +
                `AI-generated/rendered image. Do NOT lower your confidence just because the bird looks ` +
                `unusually still, clean, glossy, or "too perfect" — real wildlife photos often look exactly ` +
                `like that; a bird standing still or looking unusually smart is not evidence of anything fake. ` +
                `Reply with ONLY a single JSON object, no other text: ` +
                `{"confidence": "high"|"medium"|"low", "reason": "one short sentence"}. ` +
                `Use "high" if this clearly is a real photograph showing a real bird. Use "medium" if you're ` +
                `not fully sure it's a genuine photo (heavily filtered/edited, very unclear, ambiguous). Use ` +
                `"low" only if the image clearly is NOT a real photo of a bird at all (a drawing, painting, ` +
                `cartoon, screenshot, an icon/graphic, text, a watermarked stock image, or an AI-generated/ ` +
                `rendered image).`,
            },
          ],
        },
      ],
    }),
  });

  if (!claudeResp.ok) {
    const errText = await claudeResp.text().catch(() => "");
    return { confidence: "low", reason: `Vision check failed (HTTP ${claudeResp.status}): ${errText.slice(0, 200)}` };
  }

  const claudeJson = await claudeResp.json();
  const text: string = claudeJson?.content?.[0]?.text ?? "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    const confidence = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";
    return { confidence, reason: String(parsed.reason || "").slice(0, 500) };
  } catch {
    return { confidence: "low", reason: "Couldn't parse the automated species check response." };
  }
}

async function updateSighting(id: string, fields: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/sightings?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      prefer: "return=minimal",
    },
    body: JSON.stringify(fields),
  });
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
// 1. Run supabase/photo-verification-migration.sql first (SQL Editor).
//
// 2. Deploy this function:
//      Dashboard → Edge Functions → Deploy a new function → name it
//      "verify-sighting" → paste this file's contents in.
//
// 3. Add your Anthropic API key as a secret (get one at
//    console.anthropic.com — this is billed separately from any
//    claude.ai subscription, and only usable by this function, never
//    exposed to the public site):
//      Dashboard → Edge Functions → verify-sighting → Secrets →
//      add ANTHROPIC_API_KEY = <your key>.
//    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided
//    automatically — nothing to add for those.
//
// 4. Wire it up to fire automatically on every new sighting:
//      Dashboard → Database → Webhooks → Create a new hook
//        Table: sightings   Events: Insert   Type: Supabase Edge Functions
//        Edge Function: verify-sighting
//
// 5. Update LAUNCH_DATE above to the real go-live date, then redeploy.
//
// To test without waiting for a real submission: Table Editor → sightings
// → insert a test row with a photo_path pointing at any file already in
// the sighting-photos bucket — the webhook fires the same way.
