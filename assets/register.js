// Curiosity by Georgie — registration form logic
//
// Handles the parent/guardian consent flow (shown only when the entered
// date of birth is under 18) and submits the form to Supabase via
// registerParticipant() in assets/supabase-client.js, which now calls
// register_participant() — see supabase/parent-consent-migration.sql.
//
// This used to be a simple self-declared "I confirm I am this
// participant's parent or guardian" tickbox. Per Ashlee Zileski's
// (Sprintlaw) recommendation during the 2026-10-29 legal review, a minor
// registering here no longer ticks anything about consent themselves —
// they just give us their parent/guardian's name + email, and the real
// consent step happens separately, by the actual parent, on
// parent-consent.html, once they confirm the email we send them. Until
// they do, the registration sits as `status = 'pending_consent'` (can't
// log sightings yet) — see register_participant() for exactly how that
// decision is made server-side (never trusted to this file alone).
//
// hashPin() is defined in assets/supabase-client.js (loaded before this
// file on register.html) and shared with assets/script.js, which hashes
// the PIN a participant re-enters at sighting-log time the same way, so
// the two digests can be compared server-side without either end ever
// seeing the other's actual PIN.

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("register-form");
  if (!form) return;

  var dobInput = document.getElementById("dob");
  var parentField = document.getElementById("parent-consent-field");
  var parentNameInput = document.getElementById("parent-name");
  var parentEmailInput = document.getElementById("parent-email");
  var statusEl = document.getElementById("form-status");

  function isUnder18(dobStr) {
    if (!dobStr) return false;
    var dob = new Date(dobStr + "T00:00:00");
    if (isNaN(dob.getTime())) return false;
    var today = new Date();
    var age = today.getFullYear() - dob.getFullYear();
    var hasHadBirthdayThisYear =
      today.getMonth() > dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
    if (!hasHadBirthdayThisYear) age--;
    return age < 18;
  }

  function refreshConsentVisibility() {
    var minor = isUnder18(dobInput.value);
    parentField.hidden = !minor;
    parentNameInput.required = minor;
    parentEmailInput.required = minor;
    if (!minor) {
      parentNameInput.value = "";
      parentEmailInput.value = "";
    }
  }

  dobInput.addEventListener("change", refreshConsentVisibility);
  dobInput.addEventListener("blur", refreshConsentVisibility);

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.hidden = !text;
    statusEl.textContent = text || "";
  }

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();

    var dobStr = dobInput.value;
    var dob = new Date(dobStr + "T00:00:00");
    if (isNaN(dob.getTime()) || dob.getTime() > Date.now()) {
      setStatus("Please enter a valid date of birth.");
      return;
    }

    var data = new FormData(form);
    var pin = (data.get("pin") || "").toString().trim();
    var pinConfirm = (data.get("pinConfirm") || "").toString().trim();

    if (!/^[0-9]{6}$/.test(pin)) {
      setStatus("Your PIN needs to be exactly 6 digits.");
      return;
    }
    if (pin !== pinConfirm) {
      setStatus("Those two PINs don't match — check them and try again.");
      return;
    }

    var minor = isUnder18(dobStr);
    var parentName = (data.get("parentName") || "").toString().trim();
    var parentEmail = (data.get("parentEmail") || "").toString().trim();
    var parentRelationship = (data.get("parentRelationship") || "").toString().trim();

    if (minor && (!parentName || !parentEmail)) {
      setStatus("We need a parent or guardian's name and email before this can be submitted.");
      return;
    }

    var record = {
      displayName: (data.get("displayName") || "").toString().trim(),
      fullName: (data.get("fullName") || "").toString().trim(),
      dob: dobStr,
      addressLine: (data.get("addressLine") || "").toString().trim(),
      suburb: (data.get("suburb") || "").toString().trim(),
      state: (data.get("state") || "").toString().trim(),
      postcode: (data.get("postcode") || "").toString().trim(),
      phone: (data.get("phone") || "").toString().trim(),
      email: (data.get("email") || "").toString().trim(),
      parentName: minor ? parentName : null,
      parentEmail: minor ? parentEmail : null,
      parentRelationship: minor ? (parentRelationship || "Parent") : null,
    };

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Registering…");

    if (typeof registerParticipant !== "function") {
      setStatus("Registration isn't available right now — please try again shortly.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    hashPin(pin)
      .then(function (pinHash) {
        record.pinHash = pinHash;
        return registerParticipant(record);
      })
      .then(function (result) {
        try {
          window.localStorage.setItem("cg_participant_name", record.displayName);
        } catch (e) {
          // localStorage unavailable (private browsing etc.) — not essential.
        }
        form.hidden = true;

        // A minor's registration isn't active yet — it only becomes so
        // once their parent/guardian confirms via the emailed link (see
        // parent-consent.html). Show that instead of the usual "you're
        // registered, go log a sighting" message, and skip the Founding
        // Flock lookup below entirely — fetchParticipantDashboard() only
        // works for an active participant.
        if (result && result.consent_pending) {
          setStatus(
            "Almost there — we've emailed " + record.parentEmail + " to ask your parent or guardian to approve this " +
            "registration. Once they confirm, “" + record.displayName + "” will be fully registered and ready to log sightings."
          );
          return;
        }

        // Founding Flock check — see supabase/founding-flock-migration.sql.
        // The rank was assigned server-side the instant the registration
        // above was inserted; this is just reading it back to decide what
        // to say. Never lets this extra lookup hold up or fail the
        // registration itself — if it errors or isn't available, we just
        // fall back to the plain confirmation message.
        var plainMessage =
          "You're registered as “" + record.displayName + "” — head to Log a Sighting to get started.";

        if (typeof fetchParticipantDashboard !== "function") {
          setStatus(plainMessage);
          return;
        }

        fetchParticipantDashboard(record.displayName, record.pinHash)
          .then(function (dash) {
            var rank = dash && dash.founding_flock_rank;
            if (rank) {
              setStatus(
                "You're registered as “" + record.displayName + "” — and you're Founding Flock member #" + rank +
                "! That badge is yours for good. Head to Log a Sighting to get started."
              );
            } else {
              setStatus(plainMessage);
            }
          })
          .catch(function () {
            setStatus(plainMessage);
          });
      })
      .catch(function (err) {
        var code = err && err.code;
        var message = err && err.message;
        var text = "Something went wrong — please try again, or get in touch via the Contact page if it keeps happening.";
        if (message === "offline-demo") {
          text = "Registration isn't connected to the shared database right now — please try again shortly.";
        } else if (message === "parent_name_required" || message === "parent_email_required") {
          text = "We need a parent or guardian's name and email before this can be submitted.";
        } else if (code === "23505") {
          text = "That display name is already registered — try adding an initial or your suburb, or if that's you, head to Log a Sighting.";
        } else if (code === "23514") {
          text = "That registration couldn't be saved as entered — double-check the date of birth and parent/guardian details above.";
        }
        setStatus(text);
        if (submitBtn) submitBtn.disabled = false;
      });
  });
});
