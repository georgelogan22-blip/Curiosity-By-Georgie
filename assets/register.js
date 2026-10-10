// Curiosity by Georgie — registration form logic
//
// Handles the parental-consent checkbox (shown only when the entered
// date of birth is under 18) and submits the form to Supabase via
// registerParticipant() in assets/supabase-client.js. The database
// enforces the same under-18 rule server-side (see
// supabase/registration-migration.sql) — this front-end check is just
// so people see the checkbox before they hit submit, not the only
// thing standing between a minor and an unapproved registration.

// hashPin() is defined in assets/supabase-client.js (loaded before this
// file on register.html) and shared with assets/script.js, which hashes
// the PIN a participant re-enters at sighting-log time the same way, so
// the two digests can be compared server-side without either end ever
// seeing the other's actual PIN.

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("register-form");
  if (!form) return;

  var dobInput = document.getElementById("dob");
  var consentField = document.getElementById("parental-consent-field");
  var consentBox = document.getElementById("parental-consent");
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
    consentField.hidden = !minor;
    consentBox.required = minor;
    if (!minor) consentBox.checked = false;
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

    if (!/^[0-9]{4}$/.test(pin)) {
      setStatus("Your PIN needs to be exactly 4 digits.");
      return;
    }
    if (pin !== pinConfirm) {
      setStatus("Those two PINs don't match — check them and try again.");
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
      parentalConsent: !!(data.get("parentalConsent")),
    };

    if (isUnder18(record.dob) && !record.parentalConsent) {
      setStatus("A parent or guardian needs to tick the approval box above before this can be submitted.");
      return;
    }

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
      .then(function () {
        try {
          window.localStorage.setItem("cg_participant_name", record.displayName);
        } catch (e) {
          // localStorage unavailable (private browsing etc.) — not essential.
        }
        form.hidden = true;
        setStatus(
          "You're registered as “" + record.displayName + "” — head to Log a Sighting to get started."
        );
      })
      .catch(function (err) {
        var code = err && err.code;
        var message = "Something went wrong — please try again, or get in touch via the Contact page if it keeps happening.";
        if (err && err.message === "offline-demo") {
          message = "Registration isn't connected to the shared database right now — please try again shortly.";
        } else if (code === "23505") {
          message = "That display name is already registered — try adding an initial or your suburb, or if that's you, head to Log a Sighting.";
        } else if (code === "23514") {
          message = "A parent or guardian needs to tick the approval box above before this can be submitted.";
        }
        setStatus(message);
        if (submitBtn) submitBtn.disabled = false;
      });
  });
});
