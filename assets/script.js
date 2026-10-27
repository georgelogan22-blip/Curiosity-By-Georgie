// Curiosity by Georgie — The Brisbane Air 50
//
// Wires the sighting form to the shared Supabase backend when
// assets/supabase-client.js has real project credentials filled in
// (see that file). Until then — or if a save fails — it falls back to
// holding entries in memory for the current page view only, same as
// the original front-end-only demo, so the form still feels alive.

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("sighting-form");
  if (!form) return;

  var feed = document.getElementById("log-feed");
  var empty = document.getElementById("log-empty");
  var counter = document.getElementById("session-count");
  var statusEl = document.getElementById("form-status");
  var entries = [];

  function renderFeed() {
    if (entries.length === 0) {
      empty.style.display = "block";
      feed.innerHTML = "";
      return;
    }
    empty.style.display = "none";
    feed.innerHTML = entries
      .map(function (e) {
        var tierMatch = typeof lookupSpecies === "function" ? lookupSpecies(e.species) : null;
        var tierBit = tierMatch
          ? ' <span class="tier-badge ' + SPECIES_TIERS[tierMatch.tier].className + '">' + tierMatch.tier + "</span>" +
            ' <span class="tier-points">' + tierMatch.points + (tierMatch.points === 1 ? "pt" : "pts") + "</span>"
          : "";
        return (
          '<li class="log-entry">' +
          "<strong>" + escapeHtml(e.species) + "</strong>" + tierBit + " — " + escapeHtml(e.location) +
          '<div class="meta">' +
          escapeHtml(e.name) + " · " + escapeHtml(e.date) +
          (e.notes ? " · " + escapeHtml(e.notes) : "") +
          "</div></li>"
        );
      })
      .join("");
    if (counter) counter.textContent = String(entries.length);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function resetForNextEntry() {
    form.reset();
    var dateInput = form.querySelector('input[name="date"]');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    var nameInput = form.querySelector('input[name="name"]');
    if (nameInput) nameInput.focus();
  }

  function setStatusHtml(html) {
    if (!statusEl) return;
    statusEl.hidden = !html;
    statusEl.innerHTML = html || "";
  }

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    var data = new FormData(form);
    var species = (data.get("species") || "").toString().trim();
    var name = (data.get("name") || "").toString().trim();
    var pin = (data.get("pin") || "").toString().trim();
    if (!species || !name) return;

    if (!/^[0-9]{6}$/.test(pin)) {
      setStatusHtml("Enter the 6-digit PIN you chose when you registered.");
      return;
    }

    var photoInput = form.querySelector('input[name="photo"]');
    var photoFile = photoInput && photoInput.files && photoInput.files[0];
    if (!photoFile) {
      setStatusHtml("Attach a photo of the bird as evidence — every sighting needs one.");
      return;
    }

    var record = {
      name: name,
      species: species,
      date: (data.get("date") || "").toString(),
      location: (data.get("location") || "").toString().trim() || "Greater Brisbane",
      notes: (data.get("notes") || "").toString().trim(),
    };

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setStatusHtml("Checking your registration…");

    var checkStatus = typeof participantStatus === "function"
      ? participantStatus(name)
      : Promise.resolve(null);

    checkStatus
      .catch(function () {
        // Status check failed for some other reason (network hiccup,
        // backend not configured) — don't block the attempt on that;
        // let the actual save below succeed or fail on its own.
        return "unknown";
      })
      .then(function (status) {
        if (status === null) {
          setStatusHtml(
            'You\'ll need to <a href="register.html">register</a> first — it only takes a minute, then come back and log this sighting under the same name.'
          );
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        if (status === "banned") {
          setStatusHtml(
            "This name isn't able to log sightings. If you think this is a mistake, <a href=\"contact.html?topic=account\">get in touch</a>."
          );
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        setStatusHtml("Uploading photo…");
        var save =
          typeof submitSighting === "function" &&
          typeof hashPin === "function" &&
          typeof uploadSightingPhoto === "function"
            ? uploadSightingPhoto(photoFile)
                .then(function (photoPath) {
                  record.photoPath = photoPath;
                  return typeof readPhotoTakenDate === "function"
                    ? readPhotoTakenDate(photoFile)
                    : null;
                })
                .then(function (photoTakenAt) {
                  record.photoTakenAt = photoTakenAt;
                  setStatusHtml("Saving…");
                  return hashPin(pin);
                })
                .then(function (pinHash) {
                  record.pinHash = pinHash;
                  return submitSighting(record);
                })
            : Promise.reject(new Error("offline-demo"));

        return save
          .then(function () {
            setStatusHtml(
              "Saved — sitting as <strong>pending</strong> while it's checked. Confirmed sightings show up on the Leaderboard within a minute or two; anything the automatic check isn't sure about waits for Georgie to take a look."
            );
            entries.unshift(record);
            renderFeed();
            resetForNextEntry();
          })
          .catch(function (err) {
            var msg = err && err.message;
            if (msg === "offline-demo") {
              setStatusHtml("Demo mode — this entry isn't saved anywhere yet.");
            } else if (msg === "not_registered" || err && err.code === "42501") {
              setStatusHtml(
                'That name isn\'t registered yet — <a href="register.html">register here</a>, then log this sighting again.'
              );
            } else if (msg === "not_active") {
              setStatusHtml(
                "This name isn't able to log sightings. If you think this is a mistake, <a href=\"contact.html?topic=account\">get in touch</a>."
              );
            } else if (msg === "invalid_pin") {
              setStatusHtml('<span class="status-warn">That PIN doesn\'t match this name — check it and try again.</span>');
            } else if (msg === "pin_locked") {
              setStatusHtml('<span class="status-warn">Too many incorrect PIN attempts — this name is locked for 15 minutes. <a href="forgot-pin.html">Forgot your PIN?</a></span>');
            } else if (msg === "photo_required") {
              setStatusHtml("That photo didn't come through — please attach it again and resubmit.");
            } else {
              setStatusHtml("Couldn't reach the shared log right now — please try again.");
            }
          })
          .then(function () {
            if (submitBtn) submitBtn.disabled = false;
          });
      });
  });

  // Pre-fill today's date, and the name field if this browser has
  // registered before (see assets/register.js) — matches the site's
  // simple "type your name" pattern, just saving a retype.
  var dateField = form.querySelector('input[name="date"]');
  if (dateField) dateField.value = new Date().toISOString().slice(0, 10);

  var nameField = form.querySelector('input[name="name"]');
  if (nameField && !nameField.value) {
    try {
      var savedName = window.localStorage.getItem("cg_participant_name");
      if (savedName) nameField.value = savedName;
    } catch (e) {
      // localStorage unavailable — fine, just means no prefill.
    }
  }

  renderFeed();
});
