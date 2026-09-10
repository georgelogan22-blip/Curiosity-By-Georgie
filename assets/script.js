// Curiously Georgie — The Brisbane Air 50
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

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    var data = new FormData(form);
    var species = (data.get("species") || "").toString().trim();
    var name = (data.get("name") || "").toString().trim();
    if (!species || !name) return;

    var record = {
      name: name,
      species: species,
      date: (data.get("date") || "").toString(),
      location: (data.get("location") || "").toString().trim() || "Greater Brisbane",
      notes: (data.get("notes") || "").toString().trim(),
    };

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Saving…";
    }

    var save = typeof submitSighting === "function"
      ? submitSighting(record)
      : Promise.reject(new Error("offline-demo"));

    save
      .then(function () {
        if (statusEl) statusEl.textContent = "Saved to the shared log — thanks!";
        entries.unshift(record);
        renderFeed();
        resetForNextEntry();
      })
      .catch(function (err) {
        // Backend not configured yet, or the request failed — still show
        // the entry in this session's own feed so the form isn't a dead end.
        entries.unshift(record);
        renderFeed();
        resetForNextEntry();
        if (statusEl) {
          statusEl.textContent = (err && err.message === "offline-demo")
            ? "Demo mode — this entry isn't saved anywhere yet."
            : "Couldn't reach the shared log right now — kept locally for this session.";
        }
      })
      .then(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });

  // Pre-fill today's date.
  var dateField = form.querySelector('input[name="date"]');
  if (dateField) dateField.value = new Date().toISOString().slice(0, 10);

  renderFeed();
});
