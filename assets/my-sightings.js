// Curiosity by Georgie — My Sightings: personal dashboard
//
// Enter your registered display name + PIN (same as logging a sighting)
// to see your own dashboard: a chosen bird avatar, your live level (Air
// Novice through Air Master, based on confirmed species), your Air
// Points, and your sightings split into Confirmed / Pending / Rejected
// tabs. Calls fetchParticipantDashboard() + fetchMySightings() in
// assets/supabase-client.js — the first for the profile summary
// (participant_dashboard(), see supabase/avatar-migration.sql), the
// second for the actual sighting rows (participant_sightings(), see
// supabase/my-sightings-migration.sql). Both are PIN-gated the same way
// a visitor can't browse anyone else's data just by typing their name.
//
// Deliberately still name+PIN-per-visit, not a persistent login — same
// no-accounts approach the rest of the site uses (George's call when
// this was scoped).

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("my-sightings-form");
  if (!form) return;

  var statusEl = document.getElementById("mys-status");
  var results = document.getElementById("mys-results");

  // Kept after a successful lookup so the avatar picker can save a
  // change without asking the PIN a second time — cleared if the page
  // is reloaded, same lifetime as everything else this page shows.
  var session = { name: null, pinHash: null };

  // ---- Level system ----------------------------------------------------
  // Five levels across the Brisbane Air 50's 50 species, roughly every
  // ten — "Air Master" here is a live, self-updating read on progress
  // (see it the moment a sighting is confirmed), separate from the
  // official "Air 50 Master" Hall of Fame induction, which still goes
  // through Georgie's own review once all 50 are in (see rules.html).
  var LEVELS = [
    { name: "Air Novice", min: 0 },
    { name: "Air Fledgling", min: 10 },
    { name: "Air Spotter", min: 20 },
    { name: "Air Ranger", min: 30 },
    { name: "Air Master", min: 40 },
  ];
  var LEVEL_MAX = 50;

  function levelFor(speciesCount) {
    var current = LEVELS[0];
    var idx = 0;
    for (var i = 0; i < LEVELS.length; i++) {
      if (speciesCount >= LEVELS[i].min) {
        current = LEVELS[i];
        idx = i;
      }
    }
    return { current: current, index: idx, next: LEVELS[idx + 1] || null };
  }

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
    if (row.review_notes) return row.review_notes;
    return "Waiting to be checked — most sightings are reviewed within 48 hours.";
  }

  function noteFor(row) {
    if (row.status === "pending") return friendlyPendingNote(row);
    if (row.status === "rejected") return row.review_notes || "Didn't pass review — email us if you think this is a mistake.";
    return "On the Leaderboard now.";
  }

  // ---- Profile header: avatar, level meter, stat tiles -----------------
  function renderProfileCard(profile) {
    var speciesCount = profile.species_count || 0;
    var points = profile.total_points || 0;
    var lvl = levelFor(speciesCount);
    var pct = Math.max(0, Math.min(100, Math.round((speciesCount / LEVEL_MAX) * 100)));
    var photoUrl = (typeof avatarPhotoUrl === "function") ? avatarPhotoUrl(profile.avatar_photo_path) : null;

    var nextLine;
    if (lvl.next) {
      nextLine = (lvl.next.min - speciesCount) + " more confirmed " + ((lvl.next.min - speciesCount) === 1 ? "species" : "species") + " to reach <strong>" + lvl.next.name + "</strong>";
    } else if (speciesCount >= LEVEL_MAX) {
      nextLine = "All 50 species confirmed! Georgie will be in touch to confirm your Hall of Fame induction.";
    } else {
      nextLine = (LEVEL_MAX - speciesCount) + " more confirmed species to complete the Brisbane Air 50";
    }

    // Tick marks at each level boundary (10/20/30/40), positioned by %
    // of the 0–50 track — same track the fill uses, so a tick always
    // lines up with where that level actually starts.
    var ticks = LEVELS
      .filter(function (l) { return l.min > 0; })
      .map(function (l) {
        return '<span class="level-tick" style="left:' + ((l.min / LEVEL_MAX) * 100) + '%" title="' + escapeHtml(l.name) + ' at ' + l.min + '"></span>';
      })
      .join("");

    return (
      '<div class="dashboard-profile">' +
      '<div class="dashboard-avatar">' +
      '<button type="button" class="dashboard-avatar-btn" id="avatar-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="avatar-picker" aria-label="Change your character">' +
      renderAvatarBadge(profile.avatar_key, photoUrl, 84, profile.display_name) +
      '<span class="dashboard-avatar-edit">Change</span>' +
      "</button>" +
      '<div class="avatar-picker" id="avatar-picker" hidden>' +
      '<p class="avatar-picker-label">Choose your character</p>' +
      '<div class="avatar-picker-grid">' +
      AVATARS.map(function (a) {
        var selected = a.key === profile.avatar_key;
        return (
          '<button type="button" class="avatar-option' + (selected ? " selected" : "") + '" data-avatar-key="' + a.key + '" aria-pressed="' + selected + '" title="' + escapeHtml(a.label) + '">' +
          avatarSvg(a.key, 48) +
          '<span>' + escapeHtml(a.label) + "</span>" +
          "</button>"
        );
      }).join("") +
      "</div>" +
      '<div class="avatar-picker-photo">' +
      '<input type="file" accept="image/*" id="avatar-photo-input" class="avatar-photo-input">' +
      '<label class="avatar-photo-upload-btn" for="avatar-photo-input">Or upload your own photo</label>' +
      '<button type="button" class="avatar-photo-remove-btn" id="avatar-photo-remove"' + (profile.avatar_photo_path ? "" : " hidden") + ">Remove photo</button>" +
      "</div>" +
      '<p class="hint" id="avatar-picker-status" style="margin:10px 0 0;"></p>' +
      "</div>" +
      "</div>" +
      '<div class="dashboard-headline">' +
      '<p class="dashboard-greeting">Welcome back, <strong>' + escapeHtml(profile.display_name || "") + "</strong></p>" +
      '<div class="level-meter">' +
      '<div class="level-meter-top">' +
      '<span class="level-name">' + escapeHtml(lvl.current.name) + "</span>" +
      '<span class="level-fraction">' + speciesCount + " / " + LEVEL_MAX + " species</span>" +
      "</div>" +
      '<div class="level-track"><div class="level-fill" style="width:' + pct + '%"></div>' + ticks + "</div>" +
      '<p class="level-next">' + nextLine + "</p>" +
      "</div>" +
      "</div>" +
      '<div class="dashboard-stats">' +
      '<div class="stat-tile"><span class="num">' + speciesCount + '</span><span class="label">Species confirmed</span></div>' +
      '<div class="stat-tile"><span class="num">' + points + '</span><span class="label">Air Points</span></div>' +
      '<div class="stat-tile"><span class="num">' + (LEVEL_MAX - speciesCount > 0 ? LEVEL_MAX - speciesCount : 0) + '</span><span class="label">Species to go</span></div>' +
      "</div>" +
      "</div>"
    );
  }

  // ---- Sightings tabs ----------------------------------------------------
  function renderTableRows(rows) {
    if (!rows.length) {
      return '<p class="hint">Nothing here yet.</p>';
    }
    return (
      '<div class="table-scroll"><table><thead><tr>' +
      "<th>Species</th><th>Status</th><th>Date seen</th><th>Note</th>" +
      "</tr></thead><tbody>" +
      rows
        .map(function (row) {
          var meta = STATUS_META[row.status] || { label: row.status, className: "" };
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
            escapeHtml(noteFor(row)) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }

  function renderTabs(rows) {
    var byStatus = { confirmed: [], pending: [], rejected: [] };
    rows.forEach(function (row) {
      (byStatus[row.status] || byStatus.pending).push(row);
    });

    var order = ["confirmed", "pending", "rejected"];
    var labels = { confirmed: "Confirmed", pending: "Pending", rejected: "Rejected" };

    var tabButtons = order
      .map(function (key, i) {
        return (
          '<button type="button" class="sightings-tab' + (i === 0 ? " active" : "") + '" data-tab="' + key + '" role="tab" aria-selected="' + (i === 0) + '">' +
          labels[key] + ' <span class="sightings-tab-count">' + byStatus[key].length + "</span>" +
          "</button>"
        );
      })
      .join("");

    var tabPanels = order
      .map(function (key, i) {
        return '<div class="sightings-tab-panel' + (i === 0 ? " active" : "") + '" data-tab-panel="' + key + '" role="tabpanel">' + renderTableRows(byStatus[key]) + "</div>";
      })
      .join("");

    return (
      '<div class="sightings-tabs" role="tablist" aria-label="Your sightings by status">' + tabButtons + "</div>" +
      '<div class="sightings-tab-panels">' + tabPanels + "</div>"
    );
  }

  // ---- Wiring after render ----------------------------------------------
  function wireAvatarPicker(profile) {
    var toggle = document.getElementById("avatar-toggle");
    var panel = document.getElementById("avatar-picker");
    var pickerStatus = document.getElementById("avatar-picker-status");
    var photoInput = document.getElementById("avatar-photo-input");
    var removePhotoBtn = document.getElementById("avatar-photo-remove");
    if (!toggle || !panel) return;

    toggle.addEventListener("click", function () {
      var open = !panel.hidden;
      panel.hidden = open;
      toggle.setAttribute("aria-expanded", String(!open));
    });

    document.addEventListener("click", function (e) {
      if (panel.hidden) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });

    // Redraws the toggle button's badge from the current profile state —
    // shared by the icon picker, photo upload and photo removal so all
    // three leave the button showing exactly what's now saved.
    function refreshToggleBadge() {
      var url = (typeof avatarPhotoUrl === "function") ? avatarPhotoUrl(profile.avatar_photo_path) : null;
      toggle.innerHTML = renderAvatarBadge(profile.avatar_key, url, 84, profile.display_name) + '<span class="dashboard-avatar-edit">Change</span>';
    }

    function setPickerBusy(busy) {
      panel.querySelectorAll(".avatar-option").forEach(function (b) { b.disabled = busy; });
      if (photoInput) photoInput.disabled = busy;
      if (removePhotoBtn) removePhotoBtn.disabled = busy;
    }

    panel.querySelectorAll(".avatar-option").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-avatar-key");
        if (key === profile.avatar_key && !profile.avatar_photo_path) return;

        if (typeof updateParticipantAvatar !== "function" || !session.name || !session.pinHash) {
          if (pickerStatus) pickerStatus.textContent = "Couldn't save right now — please try again.";
          return;
        }

        setPickerBusy(true);
        if (pickerStatus) pickerStatus.textContent = "Saving…";

        updateParticipantAvatar(session.name, session.pinHash, key)
          .then(function () {
            profile.avatar_key = key;
            profile.avatar_photo_path = null; // picking an icon clears any stored photo, same as the database does
            panel.querySelectorAll(".avatar-option").forEach(function (b) {
              b.classList.toggle("selected", b === btn);
              b.setAttribute("aria-pressed", String(b === btn));
            });
            if (removePhotoBtn) removePhotoBtn.hidden = true;
            setPickerBusy(false);
            refreshToggleBadge();
            if (pickerStatus) pickerStatus.textContent = "Saved!";
            window.setTimeout(function () {
              if (pickerStatus) pickerStatus.textContent = "";
            }, 2000);
          })
          .catch(function () {
            setPickerBusy(false);
            if (pickerStatus) pickerStatus.textContent = "Couldn't save that — please try again.";
          });
      });
    });

    if (photoInput) {
      photoInput.addEventListener("change", function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) return;

        if (
          typeof uploadAvatarPhoto !== "function" ||
          typeof updateParticipantAvatarPhoto !== "function" ||
          !session.name ||
          !session.pinHash
        ) {
          if (pickerStatus) pickerStatus.textContent = "Couldn't upload right now — please try again.";
          photoInput.value = "";
          return;
        }

        if (file.type.indexOf("image/") !== 0) {
          if (pickerStatus) pickerStatus.textContent = "Please choose an image file.";
          photoInput.value = "";
          return;
        }

        setPickerBusy(true);
        if (pickerStatus) pickerStatus.textContent = "Uploading…";

        uploadAvatarPhoto(file)
          .then(function (path) {
            return updateParticipantAvatarPhoto(session.name, session.pinHash, path).then(function () {
              return path;
            });
          })
          .then(function (path) {
            profile.avatar_photo_path = path;
            panel.querySelectorAll(".avatar-option").forEach(function (b) {
              b.classList.remove("selected");
              b.setAttribute("aria-pressed", "false");
            });
            if (removePhotoBtn) removePhotoBtn.hidden = false;
            setPickerBusy(false);
            refreshToggleBadge();
            if (pickerStatus) pickerStatus.textContent = "Saved!";
            photoInput.value = "";
            window.setTimeout(function () {
              if (pickerStatus) pickerStatus.textContent = "";
            }, 2000);
          })
          .catch(function () {
            setPickerBusy(false);
            photoInput.value = "";
            if (pickerStatus) pickerStatus.textContent = "Couldn't upload that photo — please try again.";
          });
      });
    }

    if (removePhotoBtn) {
      removePhotoBtn.addEventListener("click", function () {
        if (typeof updateParticipantAvatarPhoto !== "function" || !session.name || !session.pinHash) {
          if (pickerStatus) pickerStatus.textContent = "Couldn't save right now — please try again.";
          return;
        }

        setPickerBusy(true);
        if (pickerStatus) pickerStatus.textContent = "Removing…";

        updateParticipantAvatarPhoto(session.name, session.pinHash, null)
          .then(function () {
            profile.avatar_photo_path = null;
            panel.querySelectorAll(".avatar-option").forEach(function (b) {
              var key = b.getAttribute("data-avatar-key");
              var selected = key === profile.avatar_key;
              b.classList.toggle("selected", selected);
              b.setAttribute("aria-pressed", String(selected));
            });
            removePhotoBtn.hidden = true;
            setPickerBusy(false);
            refreshToggleBadge();
            if (pickerStatus) pickerStatus.textContent = "Saved!";
            window.setTimeout(function () {
              if (pickerStatus) pickerStatus.textContent = "";
            }, 2000);
          })
          .catch(function () {
            setPickerBusy(false);
            if (pickerStatus) pickerStatus.textContent = "Couldn't remove that — please try again.";
          });
      });
    }
  }

  function wireTabs() {
    var tabs = results.querySelectorAll(".sightings-tab");
    var panels = results.querySelectorAll(".sightings-tab-panel");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var key = tab.getAttribute("data-tab");
        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle("active", active);
          t.setAttribute("aria-selected", String(active));
        });
        panels.forEach(function (p) {
          p.classList.toggle("active", p.getAttribute("data-tab-panel") === key);
        });
      });
    });
  }

  function renderDashboard(profile, rows) {
    results.innerHTML = renderProfileCard(profile) + renderTabs(rows);
    wireAvatarPicker(profile);
    wireTabs();
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

    if (typeof fetchMySightings !== "function" || typeof fetchParticipantDashboard !== "function" || typeof hashPin !== "function") {
      setStatus("This isn't connected to the shared log right now — please try again shortly.");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    hashPin(pin)
      .then(function (pinHash) {
        return Promise.all([fetchParticipantDashboard(name, pinHash), fetchMySightings(name, pinHash)]).then(function (res) {
          session.name = name;
          session.pinHash = pinHash;
          return res;
        });
      })
      .then(function (res) {
        setStatus("");
        var profile = res[0] || { display_name: name, avatar_key: null, species_count: 0, total_points: 0 };
        var rows = res[1] || [];
        renderDashboard(profile, rows);
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
