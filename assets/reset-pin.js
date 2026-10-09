// Curiosity by Georgie — "Reset your PIN" landing page
//
// Reads ?token=... from the URL (the link emailed by send-pin-reset —
// see supabase/functions/send-pin-reset/index.ts), and on submit hashes
// the chosen new PIN client-side with hashPin() (same as registration and
// every other PIN write on this site — the raw PIN is never sent) and
// calls redeemPinReset(), which validates the token server-side and
// swaps in the new PIN. See redeem_pin_reset() in
// supabase/pin-reset-migration.sql for what each error case below means.

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("reset-pin-form");
  if (!form) return;

  var statusEl = document.getElementById("rp-status");
  var introEl = document.getElementById("rp-intro");
  var formWrap = document.getElementById("rp-form-wrap");

  function setStatus(html) {
    if (!statusEl) return;
    statusEl.hidden = !html;
    statusEl.innerHTML = html || "";
  }

  var token = new URLSearchParams(window.location.search).get("token");

  if (!token) {
    if (introEl) {
      introEl.textContent = "This link is missing its reset token — you'll need to use the exact link from your email, or request a new one.";
    }
    if (formWrap) formWrap.hidden = true;
    setStatus('<a href="forgot-pin.html">Request a new reset link</a>.');
    return;
  }

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    var data = new FormData(form);
    var pin = (data.get("pin") || "").toString().trim();
    var pinConfirm = (data.get("pinConfirm") || "").toString().trim();

    if (!/^[0-9]{4}$/.test(pin)) {
      setStatus("Choose a 4-digit PIN (numbers only).");
      return;
    }
    if (pin !== pinConfirm) {
      setStatus('<span class="status-warn">Those two PINs don\'t match — try again.</span>');
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Saving…");

    if (typeof redeemPinReset !== "function" || typeof hashPin !== "function") {
      setStatus("This isn't connected right now — please try again shortly, or email curiositybygeorgie@gmail.com.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    hashPin(pin)
      .then(function (pinHash) {
        return redeemPinReset(token, pinHash);
      })
      .then(function () {
        if (introEl) introEl.textContent = "Your PIN has been reset — you're all set.";
        if (formWrap) formWrap.hidden = true;
        setStatus('New PIN saved. Head to <a href="log-sighting.html">Log a Sighting</a> or <a href="my-sightings.html">My Sightings</a> to use it.');
      })
      .catch(function (err) {
        var msg = err && err.message;
        if (msg === "invalid_token") {
          setStatus('That reset link isn\'t valid — <a href="forgot-pin.html">request a new one</a>.');
        } else if (msg === "token_used") {
          setStatus('That reset link has already been used — <a href="forgot-pin.html">request a new one</a> if you still need to reset your PIN.');
        } else if (msg === "token_expired") {
          setStatus('That reset link has expired (links last 30 minutes) — <a href="forgot-pin.html">request a new one</a>.');
        } else if (msg === "offline-demo") {
          setStatus("This isn't connected right now — please try again shortly, or email curiositybygeorgie@gmail.com.");
        } else {
          setStatus("Couldn't save that right now — please try again.");
        }
      })
      .then(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
});
