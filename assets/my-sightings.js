// Curiosity by Georgie — My Sightings: personal dashboard
//
// Enter your registered display name + PIN (same as logging a sighting)
// to see your own dashboard: a chosen bird avatar, your live level (Air
// Novice through Air Master, based on confirmed species — Air Master
// means all 50 are in), your Air Points, and your sightings split into
// Confirmed / Pending / Rejected tabs. Calls fetchParticipantDashboard() + fetchMySightings() in
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
  // Six levels across the Brisbane Air 50's 50 species, roughly every
  // ten — each is a live, self-updating read on progress (see it change
  // the moment a sighting is confirmed). "Air Master" is reserved for
  // exactly what the physical finisher's coin says: all 50 confirmed —
  // George's decision, 2026-09-27, after the coin prototype's engraving
  // made it clear that title needed to mean the same thing on the coin
  // and on the dashboard, not just the last 10-species band. Note this
  // is still separate from actual Hall of Fame induction, which needs
  // Georgie's own manual review after all 50 are in (see rules.html) —
  // reaching this level here is instant and automatic, induction isn't.
  var LEVELS = [
    { name: "Air Novice", min: 0 },
    { name: "Air Fledgling", min: 10 },
    { name: "Air Spotter", min: 20 },
    { name: "Air Ranger", min: 30 },
    { name: "Air Veteran", min: 40 },
    { name: "Air Master", min: 50 },
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

  // Zero-padded "#07" style Dex number — SPECIES_BY_KEY's `number` field is
  // the species' fixed 1-50 position in SPECIES_LIST (see species-data.js),
  // shown next to every Dex cell/detail so a species can be referenced the
  // same way regardless of whether it's revealed yet ("#07" either way,
  // name or "???" next to it).
  function dexNumberLabel(n) {
    return "#" + (n < 10 ? "0" + n : String(n));
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

  // ---- Species Dex -------------------------------------------------------
  // A 10x5 grid, one cell per official Air 50 species (SPECIES_LIST), each
  // showing a silhouette until that species' sighting is confirmed, then
  // revealing full-colour artwork + 3 facts. Custom artwork/facts live in
  // assets/species-art.js (SPECIES_ART), keyed the same way SPECIES_BY_KEY
  // is — lowercased/trimmed species name. A species without an entry there
  // yet still gets a working cell (via genericDexSvg()) that shows its
  // name/tier/sci-name once confirmed, with a "coming soon" note instead
  // of facts — the grid mechanic doesn't wait on all 50 illustrations.

  // Shared neutral placeholder bird for any species that doesn't have
  // custom artwork in SPECIES_ART yet. Deliberately generic (not meant to
  // resemble any one species) so it never misrepresents what was actually
  // seen — see the comment at the top of species-art.js.
  function genericDexSvg() {
    return (
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="var(--paper)" stroke="var(--line)" stroke-width="3"/>' +
      '<g class="dex-bird">' +
      '<ellipse cx="52" cy="62" rx="22" ry="17" fill="#8a8f85"/>' +
      '<circle cx="37" cy="45" r="12" fill="#8a8f85"/>' +
      '<path d="M25,45 L11,42 L25,50 Z" fill="#5c6058"/>' +
      '<path d="M62,54 Q80,52 86,66 Q72,72 60,64 Z" fill="#767b70"/>' +
      '<circle cx="34" cy="43" r="2.2" fill="#2a2d27"/>' +
      "</g></svg>"
    );
  }

  // lowercased/trimmed species names the current participant has had
  // CONFIRMED (pending/rejected don't reveal anything — same bar as
  // counting toward species_count elsewhere on this page).
  function confirmedKeySet(rows) {
    var set = {};
    (rows || []).forEach(function (row) {
      if (row.status === "confirmed" && row.species) {
        set[String(row.species).toLowerCase().trim()] = true;
      }
    });
    return set;
  }

  function renderDex(rows) {
    if (typeof SPECIES_LIST === "undefined" || !SPECIES_LIST.length) return "";

    var confirmed = confirmedKeySet(rows);
    var revealedCount = 0;

    var cells = SPECIES_LIST.map(function (sp, i) {
      var key = sp.name.toLowerCase().trim();
      var isConfirmed = !!confirmed[key];
      if (isConfirmed) revealedCount++;
      var tierInfo = SPECIES_TIERS[sp.tier] || {};
      var art = (typeof SPECIES_ART !== "undefined" && SPECIES_ART[key]) || null;
      var svg = art ? art.svg : genericDexSvg();
      // Locked cells get a PRE-RENDERED silhouette PNG (same filename with
      // "-badge" swapped for "-badge-locked") instead of relying on the
      // CSS `filter: brightness(0)` trick to grey out the full-colour
      // badge at render time. Reported 2026-10-18: iOS (Safari AND
      // Chrome — both run WebKit there) was still showing every locked
      // species in full colour even after confirming the correct filter
      // CSS was deployed and live, with Desktop Site mode making no
      // difference either — so the filter itself just isn't reliably
      // applying to these SVG <image> badges on-device, for reasons that
      // don't reproduce outside real iOS. Swapping the actual image file
      // sidesteps the problem entirely: every browser can render a plain
      // PNG as-is, no filter support required.
      if (!isConfirmed) {
        svg = svg.replace(/-badge\.png/g, "-badge-locked.png");
      }
      var number = dexNumberLabel(i + 1);
      var label = isConfirmed ? sp.name : "???";

      return (
        '<button type="button" class="dex-cell ' +
        (tierInfo.className || "") +
        " " +
        (isConfirmed ? "confirmed" : "locked") +
        '" data-dex-key="' +
        escapeHtml(key) +
        '" aria-label="' +
        number + " — " + (isConfirmed ? escapeHtml(sp.name) : "Not yet revealed") +
        '">' +
        svg +
        '<span class="dex-cell-label">' +
        '<span class="dex-cell-num">' + number + "</span>" +
        '<span class="dex-cell-name">' + escapeHtml(label) + "</span>" +
        "</span>" +
        "</button>"
      );
    }).join("");

    return (
      '<section class="dex-section">' +
      '<div class="dex-section-head"><h2>Your Species Dex</h2>' +
      '<span class="dex-progress">' + revealedCount + " / " + SPECIES_LIST.length + " revealed</span></div>" +
      '<p class="dex-intro hint">Every official Air 50 species starts as a silhouette here. Once a sighting is confirmed, the confirmed species reveals in full colour, unlocking the species fact card!</p>' +
      '<div class="dex-grid" id="dex-grid">' + cells + "</div>" +
      '<div class="dex-detail" id="dex-detail" aria-live="polite"></div>' +
      "</section>"
    );
  }

  // Stat block field order + friendly labels for the flip card's front
  // face — see the `stats` object on a SPECIES_ART entry.
  var DEX_STAT_FIELDS = [
    { key: "weight", label: "Weight" },
    { key: "length", label: "Length" },
    { key: "wingspan", label: "Wingspan" },
    { key: "footprint", label: "Footprint" }
  ];

  function renderStatGrid(stats) {
    if (!stats) return "";
    return (
      '<div class="dex-stat-grid">' +
      DEX_STAT_FIELDS.map(function (f) {
        var value = stats[f.key];
        if (!value) return "";
        return (
          '<div class="dex-stat"><span class="dex-stat-label">' + f.label + "</span>" +
          '<span class="dex-stat-value">' + escapeHtml(value) + "</span></div>"
        );
      }).join("") +
      "</div>"
    );
  }

  // Tapping a species pops its card/teaser up as a fixed, centered modal
  // over a dimmed backdrop (see the .dex-detail.open rule in styles.css)
  // instead of rendering inline under the grid — at every screen width,
  // so there's never a scroll down past the rest of the 50-cell grid to
  // see what got tapped.
  function closeDexDetail(detail) {
    detail.classList.remove("open");
    detail.innerHTML = "";
    document.body.classList.remove("dex-modal-open");
  }

  function openDexDetail(detail, bodyHtml) {
    detail.innerHTML =
      '<button type="button" class="dex-detail-close" aria-label="Close">&times;</button>' + bodyHtml;
    detail.classList.add("open");
    document.body.classList.add("dex-modal-open");
    var closeBtn = detail.querySelector(".dex-detail-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closeDexDetail(detail);
      });
    }
  }

  function wireDex(rows) {
    var grid = results.querySelector("#dex-grid");
    var detail = results.querySelector("#dex-detail");
    if (!grid || !detail) return;

    var confirmed = confirmedKeySet(rows);

    // Tapping the dimmed backdrop (i.e. anywhere in #dex-detail that
    // isn't the card/teaser itself) closes it, same as the close button
    // or Escape — only reachable at all once the mobile modal CSS makes
    // #dex-detail fill the screen.
    detail.addEventListener("click", function (e) {
      if (e.target === detail) closeDexDetail(detail);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && detail.classList.contains("open")) {
        closeDexDetail(detail);
      }
    });

    grid.querySelectorAll(".dex-cell").forEach(function (cell) {
      cell.addEventListener("click", function () {
        grid.querySelectorAll(".dex-cell.selected").forEach(function (c) {
          c.classList.remove("selected");
        });
        cell.classList.add("selected");

        var key = cell.getAttribute("data-dex-key");
        var sp = (typeof lookupSpecies === "function") ? lookupSpecies(key) : null;
        var isConfirmed = !!confirmed[key];
        var art = (typeof SPECIES_ART !== "undefined" && SPECIES_ART[key]) || null;

        if (!sp) return;

        if (!isConfirmed) {
          openDexDetail(
            detail,
            '<div class="dex-locked-box"><div class="dex-locked-box-head">' +
              (art ? art.svg : genericDexSvg()) +
              "<div><h3>" + dexNumberLabel(sp.number) + " Species unidentified</h3>" +
              '<p class="dex-detail-tier">' + escapeHtml(sp.tierLabel) + " tier · " + sp.points + " Air Points</p>" +
              "</div></div>" +
              '<p class="dex-locked-note">Spot this species and get the sighting confirmed to reveal it here.</p>' +
              "</div>"
          );
          return;
        }

        var hasImageCard = !!(art && art.card && art.card.front && art.card.back);
        var frontHtml, backHtml;

        if (hasImageCard) {
          // George's own fully-designed card art — shown edge-to-edge,
          // with no auto-built name/stats/facts markup overlaid (it's all
          // baked into the image already).
          frontHtml =
            '<img src="' + art.card.front + '" alt="' + escapeHtml(sp.name) + ' — species discovery card, front">' +
            '<span class="dex-card-flip-pill">Tap for 3 facts →</span>';
          backHtml =
            '<img src="' + art.card.back + '" alt="' + escapeHtml(sp.name) + ' — species discovery card, back">' +
            '<span class="dex-card-flip-pill">← Tap to flip back</span>';
        } else {
          // Front face: photo (if we have a real one yet) falling back to
          // the badge art, name/sci/tier, and a bio stat grid when known.
          var frontMedia = (art && art.photo)
            ? '<img src="' + art.photo + '" alt="' + escapeHtml(sp.name) + '">'
            : (art ? art.svg : genericDexSvg());

          frontHtml =
            '<div class="dex-card-photo-wrap">' + frontMedia + "</div>" +
            '<div class="dex-card-name-row"><h3>' + dexNumberLabel(sp.number) + " · " + escapeHtml(sp.name) + "</h3>" +
            '<p class="sci">' + escapeHtml(sp.sci) + "</p>" +
            '<p class="dex-detail-tier">' + escapeHtml(sp.tierLabel) + " tier · " + sp.points + " Air Points</p>" +
            "</div>" +
            (art && art.stats
              ? renderStatGrid(art.stats)
              : '<p class="dex-card-soon-note" style="margin-top:auto;">Measurements for this one are still being researched.</p>') +
            '<p class="dex-card-flip-hint">Tap the card for 3 facts →</p>';

          // Back face: the 3 facts, Curiosity by Georgie style.
          backHtml =
            "<h4>" + escapeHtml(sp.name) + " — 3 things worth knowing</h4>" +
            (art && art.facts
              ? "<ul>" + art.facts.map(function (f) { return "<li>" + escapeHtml(f) + "</li>"; }).join("") + "</ul>"
              : '<p class="dex-card-soon-note">The full write-up for this species isn\'t ready yet — check back soon.</p>') +
            '<p class="dex-card-flip-hint">← Tap to flip back</p>';
        }

        openDexDetail(
          detail,
          '<div class="dex-card' + (hasImageCard ? " dex-card-imagecard" : "") + '" tabindex="0" role="button" aria-pressed="false" aria-label="' +
            escapeHtml(sp.name) + ' card — tap to flip between ' + (hasImageCard ? "front and back" : "stats and facts") + '">' +
            '<div class="dex-card-inner">' +
            '<div class="dex-card-face dex-card-front' + (hasImageCard ? " dex-card-image-face" : "") + '">' + frontHtml + "</div>" +
            '<div class="dex-card-face dex-card-back' + (hasImageCard ? " dex-card-image-face" : "") + '">' + backHtml + "</div>" +
            "</div></div>"
        );

        var cardEl = detail.querySelector(".dex-card");
        function toggleFlip() {
          var flipped = cardEl.classList.toggle("flipped");
          cardEl.setAttribute("aria-pressed", String(flipped));
        }
        cardEl.addEventListener("click", toggleFlip);
        cardEl.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            toggleFlip();
          }
        });
      });
    });
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
    results.innerHTML = renderProfileCard(profile) + renderDex(rows) + renderTabs(rows);
    wireAvatarPicker(profile);
    wireDex(rows);
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
