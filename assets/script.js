// Curiously Georgie — The Brisbane Air 50
// Front-end only for this skeleton: the sighting log below is held in
// memory for the current page view so the interaction can be demoed.
// It resets on reload. Wiring this to a real, shared database (so every
// visitor's sightings feed the same leaderboard) is the next build step.

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("sighting-form");
  if (!form) return;

  var feed = document.getElementById("log-feed");
  var empty = document.getElementById("log-empty");
  var counter = document.getElementById("session-count");
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
        return (
          '<li class="log-entry">' +
          "<strong>" + escapeHtml(e.species) + "</strong> — " + escapeHtml(e.location) +
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

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    var data = new FormData(form);
    var species = (data.get("species") || "").toString().trim();
    var name = (data.get("name") || "").toString().trim();
    if (!species || !name) return;

    entries.unshift({
      name: name,
      species: species,
      date: (data.get("date") || "").toString(),
      location: (data.get("location") || "").toString().trim() || "Greater Brisbane",
      notes: (data.get("notes") || "").toString().trim(),
    });
    renderFeed();
    form.reset();
    // Keep today's date pre-filled after reset, for the next entry.
    var dateInput = form.querySelector('input[name="date"]');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    form.querySelector('input[name="name"]').focus();
  });

  // Pre-fill today's date.
  var dateField = form.querySelector('input[name="date"]');
  if (dateField) dateField.value = new Date().toISOString().slice(0, 10);

  renderFeed();
});

