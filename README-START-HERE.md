# Parent/guardian consent flow — backend plumbing

Built ahead of Ashlee's final checkbox wording so it's ready to wire up fast
once that arrives. This does **not** reopen registration — it's wired to
respect the exact same pre-launch lock that's already live today (see
step 2 below — this is the one step that actually matters before launch).

## What this replaces

The old self-declared "I confirm I am this participant's parent or
guardian" tickbox is gone. A minor now just gives their own parent/
guardian's name + email at registration; the parent gets a real email with
a confirmation link, and the registration only goes live once *they*
confirm it. Nothing self-declared by the minor anymore.

## 1. Run the new SQL migration

Supabase dashboard → SQL Editor → New query → paste the whole contents of
`supabase/parent-consent-migration.sql` → Run.

I tested this migration (and the full registration → consent → confirm
flow it creates) end-to-end against a throwaway local Postgres before
sending it to you — adult registration, a minor missing parent details
(correctly rejected), a complete minor registration, confirming consent,
re-using a used link (correctly rejected), an expired link (correctly
rejected), and the duplicate-name error. All of it worked exactly as
designed. It's also written to be safe to run twice if you're ever unsure
whether it already ran.

## 2. The one step that actually matters: don't reopen registration early

Postgres grants function access to everyone by default, so the migration
above explicitly **revokes** that for the new `register_participant()`
function in the same file — registration stays exactly as locked as it is
today (no real sign-ups accepted). You don't need to do anything for this
to be true — it already is, right after step 1.

When you're actually ready to open registration for real (legal review
cleared, launch date reached), run this one line yourself in SQL Editor:

```sql
grant execute on function public.register_participant(text, text, date, text, text, text, text, text, text, text, text, text, text) to anon;
```

That's the new on/off switch, replacing the old "grant insert on
participants" switch.

## 3. Deploy the new Edge Function

Dashboard → Edge Functions → Deploy a new function → name it
`notify-parent-consent` → paste in the contents of
`supabase/functions/notify-parent-consent/index.ts`.

It reuses the same `RESEND_API_KEY` secret and sending domain as
`send-pin-reset` — if that one's already sending real emails, there's
nothing extra to set up here.

## 4. Wire up the webhook

Dashboard → Database → Webhooks → Create a new hook:
- Table: `consent_requests`
- Events: Insert
- Type: Supabase Edge Functions
- Edge Function: `notify-parent-consent`

(Same pattern as the `pin_resets` → `send-pin-reset` webhook you already
have.)

## 5. Upload the website files

All of these go to GitHub, same as usual:

**New files:**
- `parent-consent.html` — the page a parent lands on from the emailed link
- `assets/parent-consent.js` — its logic

**Changed files:**
- `register.html` — swapped the old tickbox for parent name/email fields
  (shown only when the date of birth is under 18). **This also carries the
  Founding Flock reward disclosure fix from earlier** — the one that spells
  out the free pin badge instead of leaving it a surprise — so uploading
  this file does both at once.
- `assets/register.js` — updated to match
- `assets/supabase-client.js` — `registerParticipant()` now calls the new
  `register_participant()` function instead of inserting directly; added
  `confirmParentConsent()`
- `assets/script.js` — added a friendlier message if someone whose
  registration is still waiting on parent confirmation tries to log a
  sighting
- All the other `.html` files in here — only their cache-busting
  `?v=...` query strings changed on the shared `supabase-client.js` /
  `script.js` script tags, so browsers don't serve a stale cached copy.
  Safe to upload as-is; nothing else in them changed.

## About the checkbox wording on parent-consent.html

It's placeholder text (clearly marked as such, both as a notice on the
page itself and in a comment at the top of `assets/parent-consent.js`),
written only so the flow could be built and tested before Ashlee's exact
wording and checkbox list arrive. Once they do, the only file that needs
to change is the `CONSENT_ITEMS` array near the top of
`assets/parent-consent.js` — swap in her wording, in whatever order and
count she recommends. Nothing else (the database, the email, the page's
layout) assumes a fixed number of checkboxes.

## What's deliberately NOT included here

- No UI for a parent to request a fresh link if their first one expires
  after 7 days (the backend function for it, `resend_parent_consent()`,
  exists and is tested — there's just no button calling it yet). Cheap to
  add later; flagged in the migration's own comments.
- No changes to address/phone collection at registration — that's a
  separate, already-agreed decision (moving to a finisher-only postal
  request) that's deliberately being held until Ashlee's final wording
  arrives, so the registration form only gets rebuilt once.
