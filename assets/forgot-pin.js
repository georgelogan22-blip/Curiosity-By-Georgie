// Curiosity by Georgie — "Forgot your PIN?" request form
//
// Calls requestPinReset() in assets/supabase-client.js, which always
// resolves regardless of whether the name is actually registered — see
// that function's comment for why. So this always shows the same
// generic confirmation message, never a specific "that name isn't
// registered" error (that would let someone use this form to check which
// display names exist).

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("forgot-pin-form");
  if (!form) return;

  var statusEl = document.getElementById("fp-status");

  function setStatus(html) {
    if (!statusEl) return;
    statusEl.hidden = !html;
    statusEl.innerHTML = html || "";
  }

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    var data = new FormData(form);
    var name = (data.get("name") || "").toString().trim();
    if (!name) return;

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Sending…");

    if (typeof requestPinReset !== "function") {
      setStatus("This isn't connected right now — please try again shortly, or get in touch via the Contact page.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    requestPinReset(name)
      .then(function () {
        setStatus(
          "If that name is registered, a reset link has just been sent to the email address on file — it works for 30 minutes. Didn't get it? Check spam, or <a href=\"contact.html?topic=account&page=Forgot%20Your%20PIN%20page\">get in touch</a>.",
        );
        form.reset();
      })
      .catch(function (err) {
        var msg = err && err.message;
        if (msg === "offline-demo") {
          setStatus("This isn't connected right now — please try again shortly, or get in touch via the Contact page.");
        } else {
          setStatus("Couldn't send that right now — please try again, or get in touch via the Contact page.");
        }
      })
      .then(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
});
