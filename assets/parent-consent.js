// Curiosity by Georgie — "Parent/Guardian Consent" landing page
//
// Reads ?token=... from the URL (the link emailed by notify-parent-
// consent — see supabase/functions/notify-parent-consent/index.ts), shows
// a checklist of consent items, and on submit calls confirmParentConsent()
// which validates the token server-side and, if everything checks out,
// flips the participant to active — see confirm_parent_consent() in
// supabase/parent-consent-migration.sql.
//
// ---------------------------------------------------------------------
// CONSENT_ITEMS — PLACEHOLDER WORDING, NOT LEGAL TEXT.
// Written only so the end-to-end flow (email → this page → database)
// could be built and tested before Ashlee Zileski's (Sprintlaw) final
// checkbox wording and ordering arrive. Replace the `text` on each item
// below with her exact wording once it lands — ids, count, and order can
// all change freely; nothing elsewhere on the site assumes a fixed shape,
// since confirm_parent_consent() stores whatever's ticked as plain jsonb.
// Every item here is required (all must be ticked) before the confirm
// button enables — change `required: false` on an item if a future
// wording has an optional one.
// ---------------------------------------------------------------------
var CONSENT_ITEMS = [
  { id: "guardian", required: true,
    text: "I confirm I am the parent or legal guardian of this participant, or otherwise hold parental responsibility for them." },
  { id: "rules", required: true,
    text: "I have read the Brisbane Air 50 Rules & Regulations, including Rule #1 (Safety First)." },
  { id: "risk", required: true,
    text: "I understand this challenge takes place outdoors around real wildlife, and I consent to this participant taking part at their own (and my) risk." },
  { id: "privacy", required: true,
    text: "I understand what personal information was collected at registration, how it's used and stored, and that it is never published — see the Registration page's Your Privacy section." },
  { id: "photos", required: true,
    text: "I understand sighting photos this participant submits are reviewed by the challenge admin before being counted, and are not published without further review." },
  { id: "display-name", required: true,
    text: "I understand this participant's chosen display name (not their real name) may appear publicly on the Leaderboard and Hall of Fame." },
  { id: "withdraw", required: true,
    text: "I understand I can withdraw this consent at any time by contacting the challenge admin, which stops this participant from taking part." },
  { id: "liability", required: true,
    text: "I accept the Registration & Liability terms on this participant's behalf." },
];

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("parent-consent-form");
  if (!form) return;

  var checklistEl = document.getElementById("pc-checklist");
  var statusEl = document.getElementById("pc-status");
  var introEl = document.getElementById("pc-intro");
  var headingEl = document.getElementById("pc-heading");
  var formWrap = document.getElementById("pc-form-wrap");
  var submitBtn = form.querySelector('button[type="submit"]');

  function setStatus(html) {
    if (!statusEl) return;
    statusEl.hidden = !html;
    statusEl.innerHTML = html || "";
  }

  var token = new URLSearchParams(window.location.search).get("token");

  if (!token) {
    if (headingEl) headingEl.textContent = "Missing link";
    if (introEl) {
      introEl.textContent = "This link is missing its confirmation token — you'll need to use the exact link from the email, not a shortened or re-typed version of it.";
    }
    if (formWrap) formWrap.hidden = true;
    return;
  }

  CONSENT_ITEMS.forEach(function (item) {
    var wrap = document.createElement("label");
    wrap.style.display = "flex";
    wrap.style.alignItems = "flex-start";
    wrap.style.gap = "8px";
    wrap.style.fontWeight = "400";
    wrap.style.marginBottom = "14px";

    var box = document.createElement("input");
    box.type = "checkbox";
    box.id = "pc-item-" + item.id;
    box.dataset.itemId = item.id;
    box.required = item.required !== false;
    box.style.width = "auto";
    box.style.marginTop = "3px";

    var span = document.createElement("span");
    span.textContent = item.text;

    wrap.appendChild(box);
    wrap.appendChild(span);
    checklistEl.appendChild(wrap);
  });

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();

    var checks = {};
    checklistEl.querySelectorAll("input[type=checkbox]").forEach(function (box) {
      checks[box.dataset.itemId] = box.checked;
    });

    if (submitBtn) submitBtn.disabled = true;
    setStatus("Saving…");

    if (typeof confirmParentConsent !== "function") {
      setStatus("This isn't connected right now — please try again shortly, or get in touch via the Contact page.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    confirmParentConsent(token, checks)
      .then(function () {
        if (headingEl) headingEl.textContent = "Confirmed";
        if (introEl) introEl.textContent = "Thanks — this registration is now active.";
        if (formWrap) formWrap.hidden = true;
        setStatus("They're all set and ready to log sightings on the Brisbane Air 50.");
      })
      .catch(function (err) {
        var msg = err && err.message;
        if (msg === "invalid_token") {
          setStatus("That confirmation link isn't valid. If you still have the original email, try the link in it again, or get in touch via the Contact page.");
        } else if (msg === "token_used") {
          setStatus("That confirmation link has already been used — this registration should already be active.");
        } else if (msg === "token_expired") {
          setStatus("That confirmation link has expired (links last 7 days). Get in touch via the Contact page and we can send a fresh one.");
        } else if (msg === "offline-demo") {
          setStatus("This isn't connected right now — please try again shortly, or get in touch via the Contact page.");
        } else {
          setStatus("Couldn't save that right now — please try again.");
        }
        if (submitBtn) submitBtn.disabled = false;
      });
  });
});
