// Curiosity by Georgie — Contact form
//
// Calls submitContactMessage() in assets/supabase-client.js, which writes
// to public.contact_messages and lets a Database Webhook email George via
// Resend (see supabase/contact-migration.sql + supabase/functions/
// notify-contact-message/index.ts). Built to replace every mailto:
// curiositybygeorgie@gmail.com link on the site, which put the address in
// plain HTML for spam-harvesting bots to scrape (flagged by George's
// friend Shaun's site review, 2026-10-11).
//
// Other pages link here with ?topic=report&page=... (see e.g. chat.js's
// renderReportLink()) to preselect the topic and note what the message is
// about, without needing a mailto subject/body to carry that context.
//
// Two lightweight, no-signup anti-spam measures — neither needs George to
// set up a third-party captcha account:
//   1. A honeypot field ("website") that's invisible to real visitors but
//      visible to most bots filling in every field they find. A filled-in
//      value drops the submission silently (still shows a success
//      message, so a bot gets no signal that it was caught).
//   2. A minimum fill time — bots usually submit within a fraction of a
//      second of the page loading; a real person takes at least a couple
//      of seconds to read the form and type something. Submissions faster
//      than that are dropped the same way.
// If spam becomes a real problem despite these, a proper captcha (e.g.
// hCaptcha's free tier) is the next step up — that needs George to sign
// up for an account himself, so it's not set up by default.

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var loadedAt = Date.now();
  var statusEl = document.getElementById("ct-status");
  var topicSelect = document.getElementById("ct-topic");
  var messageField = document.getElementById("ct-message");

  function setStatus(html) {
    if (!statusEl) return;
    statusEl.hidden = !html;
    statusEl.innerHTML = html || "";
  }

  // Prefill from a query string, e.g. contact.html?topic=report&page=
  // post%20by%20Ava%20T. — used by chat.js's Report links and a couple of
  // other pages that know roughly what the message will be about.
  (function prefillFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var topic = params.get("topic");
    var page = params.get("page");
    var context = params.get("context");
    if (topic && topicSelect) {
      var hasOption = Array.prototype.some.call(topicSelect.options, function (opt) {
        return opt.value === topic;
      });
      if (hasOption) topicSelect.value = topic;
    }
    if (context && messageField && !messageField.value) {
      messageField.value = context;
    }
    if (page) {
      var hiddenPage = document.createElement("input");
      hiddenPage.type = "hidden";
      hiddenPage.name = "page";
      hiddenPage.value = page;
      form.appendChild(hiddenPage);
    }
  })();

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    var data = new FormData(form);
    var honeypot = (data.get("website") || "").toString().trim();
    var name = (data.get("name") || "").toString().trim();
    var email = (data.get("email") || "").toString().trim();
    var topic = (data.get("topic") || "general").toString();
    var message = (data.get("message") || "").toString().trim();
    var page = (data.get("page") || "").toString();

    if (!email || !message) return;

    // Looks like a bot: either the honeypot was filled in, or the form
    // was submitted implausibly fast. Show the normal success message
    // (so nothing tips off whatever filled it in) but never actually
    // save or send it.
    var tooFast = Date.now() - loadedAt < 1500;
    if (honeypot || tooFast) {
      form.reset();
      setStatus("Thanks — that's been sent through.");
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Sending…");

    if (typeof submitContactMessage !== "function") {
      setStatus("This isn't connected right now — please try again shortly.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    submitContactMessage({ name: name, email: email, topic: topic, message: message, page: page })
      .then(function () {
        setStatus("Thanks — that's been sent through. Georgie will reply to " + escapeHtml(email) + " directly.");
        form.reset();
      })
      .catch(function (err) {
        var msg = err && err.message;
        if (msg === "invalid_email") {
          setStatus("That doesn't look like a valid email address — mind double-checking it?");
        } else if (msg === "message_too_short") {
          setStatus("Could you add a bit more detail to the message?");
        } else if (msg === "message_too_long") {
          setStatus("That message is a bit too long — could you trim it down?");
        } else if (msg === "offline-demo") {
          setStatus("This isn't connected right now — please try again shortly.");
        } else {
          setStatus("Couldn't send that right now — please try again shortly.");
        }
      })
      .then(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
});
