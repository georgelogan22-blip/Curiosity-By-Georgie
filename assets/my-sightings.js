// Curiously Georgie — "My Sightings" status check
//
// Lets a participant look up their own logged sightings (pending /
// confirmed / rejected) by re-entering their display name + PIN — the
// same credentials used to log a sighting in the first place. Calls
// fetchMySightings() in assets/supabase-client.js, which hits the
// PIN-gated participant_sightings() database function (see
// supabase/my-sightings-migration.sql) rather than reading the
// sightings table directly, so a visitor can't browse anyone else's
// pending queue just by typing their name.

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("my-sightings-form");
  if (!form) return;

  var statusEl = document.getElementById("mys-status");
  var results = document.getElementById("mys-results");

  function setStatus(html) {
    if (!statusEl) return;
    statusEl.hidden = !html;
    statusEl.innerHTML = html || "";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  // status -> { label, className } for the small pill shown per row.
  // Reuses the site's existing accent colours (gold = "in progress",
  // green = "good", coral = "needs attention") rather than inventing a
  // new colour language.
  var STATUS_META = {
    pending: { label: "Pending review", className: "status-pill-pending" },
    confirmed: { label: "Confirmed", className: "status-pill-confirmed" },
    rejected: { label: "Rejected", className: "status-pill-rejected" },
  };

  function friendlyPendingNote(row) {
    // While a sighting is pending, review_notes holds whatever the
    // automated check already found (see supabase/functions/
    // verify-sighting) — show it, but keep the framing reassuring:
    // "pending" is the normal, expected state for most submissions
    // right after logging, not a sign something is wrong.
    if (row.review_notes) return row.review_notes;
    return "Waiting to be checked — most sightings are reviewed within 48 hours.";
  }

  function renderResults(rows) {
    if (!rows.length) {
      results.innerHTML =
        '<p class="hint">No sightings found yet for that name. Logged one recently? It can take a moment to appear here.</p>';
      return;
    }
    results.innerHTML =
      '<div class="table-scroll"><table><thead><tr>' +
      "<th>Species</th><th>Status</th><th>Date seen</th><th>Note</th>" +
      "</tr></thead><tbody>" +
      rows
        .map(function (row) {
          var meta = STATUS_META[row.status] || { label: row.status, className: "" };
          var note =
            row.status === "pending"
              ? friendlyPendingNote(row)
              : row.status === "rejected"
              ? row.review_notes || "Didn't pass review — email us if you think this is a mistake."
              : "On the Leaderboard now.";
          return (
            '<tr><td data-label="Species">' +
            escapeHtml(row.species) +
            '</td><td data-label="Status"><span class="status-pill ' +
            meta.className +
            '">' +
            escapeHtml(meta.label) +
            '</span></td><td data-label="Date seen">' +
            escapeHtml(row.sighting_date || "—") +
            '</td><td data-label="Note">' +
            escapeHtml(note) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>";
  }

  form.addEventListener("submit", function (evt) {
    evt.preventDefault();
    var data = new FormData(form);
    var name = (data.get("name") || "").toString().trim();
    var pin = (data.get("pin") || "").toString().trim();

    if (!name) return;
    if (!/^[0-9]{4}$/.test(pin)) {
      setStatus("Enter the 4-digit PIN you chose when you registered.");
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    results.innerHTML = "";
    setStatus("Checking…");

    if (typeof fetchMySightings !== "function" || typeof hashPin !== "function") {
      setStatus("This isn't connected to the shared log right now — please try again shortly.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    hashPin(pin)
      .then(function (pinHash) {
        return fetchMySightings(name, pinHash);
      })
      .then(function (rows) {
        setStatus("");
        renderResults(rows || []);
      })
      .catch(function (err) {
        var msg = err && err.message;
        if (msg === "offline-demo") {
          setStatus("This isn't connected to the shared log right now — please try again shortly.");
        } else if (msg === "not_registered") {
          setStatus('That name isn\'t registered yet — <a href="register.html">register here</a> first.');
        } else if (msg === "invalid_pin") {
          setStatus('<span class="status-warn">That PIN doesn\'t match this name — check it and try again.</span>');
        } else {
          setStatus("Couldn't reach the shared log right now — please try again.");
        }
      })
      .then(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
});
