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
// CONSENT_ITEMS — final wording from Sprintlaw (Ashlee Zileski),
// Website Page Wording, Part E.3 ("Consent page: parent or guardian
// declaration"), delivered 2026-11-08. Do not reword these items —
// they're the actual consent declaration, not paraphrased copy.
// ---------------------------------------------------------------------
var CONSENT_ITEMS = [
  { id: "guardian-age", required: true,
    text: "I am the parent or legal guardian of this participant (my child) and I am 18 or over." },
  { id: "consent-participate", required: true,
    text: "I consent to my child registering for and taking part in the Brisbane Air 50." },
  { id: "terms-privacy", required: true,
    text: "I have read the Website Terms and Challenge Rules and the Privacy Policy, and I agree to be bound by the Website Terms and Challenge Rules, as updated from time to time, on my child's behalf." },
  { id: "risks-liability", required: true,
    text: "I understand the risks described above and in the Website Terms and Challenge Rules, and I understand that the Website Terms and Challenge Rules limit Curiosity by Georgie's liability." },
  { id: "supervision", required: true,
    text: "I accept responsibility for supervising my child's participation, including making sure that my child follows the safety rules and, while my child is under 16, that they are accompanied by me or another responsible adult I approve when taking part outdoors (clause 3.5 of the Terms)." },
  { id: "privacy-consent", required: true,
    text: "I consent to Curiosity by Georgie collecting, using and disclosing my child's personal information, and mine, in accordance with the Privacy Policy, including publicly displaying my child's display name, avatar, species tally and progress on the Leaderboard and Hall of Fame." },
  { id: "avatar-gallery", required: true,
    text: "I understand that my child must choose an avatar from Curiosity by Georgie's gallery and cannot upload their own image." },
  { id: "photo-feature-consent", required: true,
    text: "I understand that Curiosity by Georgie will only feature my child's sighting photos on its Announcements Feed or social media accounts if it first asks for, and I give, my consent for each photo." },
  { id: "social-accounts", required: true,
    text: "I understand that Curiosity by Georgie's Facebook, Instagram and YouTube accounts are subject to each platform's own terms and minimum age requirements." },
  { id: "withdraw", required: true,
    text: "I understand that I can withdraw my consent at any time by contacting Curiosity by Georgie, and that if I do, my child's Account will be closed." },
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

  // Part E.3 also asks for the parent/guardian's full name and their
  // relationship to the child, in addition to the 10 checkboxes below.
  // confirm_parent_consent() stores whatever's passed as plain jsonb, so
  // these ride along inside the same `checks` object rather than needing
  // a dedicated database parameter.
  var nameWrap = document.createElement("div");
  nameWrap.className = "field";
  nameWrap.innerHTML =
    '<label for="pc-parent-name">Parent or guardian’s full name</label>' +
    '<input type="text" id="pc-parent-name" name="parentFullName" required>';
  checklistEl.parentNode.insertBefore(nameWrap, checklistEl);

  var relWrap = document.createElement("div");
  relWrap.className = "field";
  relWrap.style.marginBottom = "18px";
  relWrap.innerHTML =
    '<label for="pc-relationship">Relationship to child</label>' +
    '<select id="pc-relationship" name="relationshipToChild" required>' +
    '<option value="" selected disabled>Choose one…</option>' +
    '<option value="Parent">Parent</option>' +
    '<option value="Legal guardian">Legal guardian</option>' +
    '<option value="Other">Other</option>' +
    '</select>';
  checklistEl.parentNode.insertBefore(relWrap, checklistEl);

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
    var nameEl = document.getElementById("pc-parent-name");
    var relEl = document.getElementById("pc-relationship");
    checks.parentFullName = nameEl ? nameEl.value.trim() : "";
    checks.relationshipToChild = relEl ? relEl.value : "";

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
