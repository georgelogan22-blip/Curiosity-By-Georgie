// Curiosity by Georgie — tier-aware species autocomplete for the
// Log a Sighting form. Replaces the plain <datalist> so each suggestion
// can show its Air Points tier and point value (a native <datalist>
// can't reliably show more than one line of text per option across
// browsers). Typing something not on the official 50 is still allowed —
// the rules page and the hint text under the field both say so — it
// just won't show a tier badge, and defaults to 1 point on the
// Leaderboard (see supabase/points-migration.sql).
document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("species");
  var box = document.getElementById("species-suggestions");
  var hint = document.getElementById("species-tier-hint");
  if (!input || !box || typeof SPECIES_LIST === "undefined") return;

  var activeIndex = -1;
  var currentMatches = [];

  function tierBadgeHtml(tier) {
    var info = SPECIES_TIERS[tier];
    if (!info) return "";
    var cls = "tier-badge " + info.className;
    return '<span class="' + cls + '">' + tier + "</span>";
  }

  function updateHint() {
    var match = typeof lookupSpecies === "function" ? lookupSpecies(input.value) : null;
    if (match) {
      hint.innerHTML =
        tierBadgeHtml(match.tier) +
        ' <span class="tier-points">' +
        match.tierLabel +
        " · " +
        match.points +
        (match.points === 1 ? " point" : " points") +
        "</span>" +
        // Some species only confirm under a specific condition (e.g. the
        // Pheasant Coucal's breeding plumage) — see captureNote on the
        // SPECIES_LIST entry in species-data.js. Shown right here so it's
        // seen before the photo is taken/submitted, not after rejection.
        (match.captureNote
          ? '<span class="species-capture-note">⚠ ' + match.captureNote + "</span>"
          : "");
    } else if (input.value.trim()) {
      hint.textContent = "Not on the official 50 — still counts, no Air Points tier assigned.";
    } else {
      hint.textContent = "";
    }
  }

  function closeSuggestions() {
    box.hidden = true;
    box.innerHTML = "";
    activeIndex = -1;
    currentMatches = [];
  }

  function selectSpecies(name) {
    input.value = name;
    closeSuggestions();
    updateHint();
    input.focus();
  }

  function renderSuggestions(query) {
    var q = query.trim().toLowerCase();
    if (!q) {
      closeSuggestions();
      return;
    }
    var starts = [];
    var contains = [];
    SPECIES_LIST.forEach(function (sp) {
      var lower = sp.name.toLowerCase();
      if (lower.indexOf(q) === 0) starts.push(sp);
      else if (lower.indexOf(q) !== -1) contains.push(sp);
    });
    currentMatches = starts.concat(contains).slice(0, 8);
    activeIndex = -1;

    if (!currentMatches.length) {
      box.innerHTML = '<div class="no-match">No official match — you can still log it as typed.</div>';
      box.hidden = false;
      return;
    }

    box.innerHTML = currentMatches
      .map(function (sp, i) {
        var info = SPECIES_TIERS[sp.tier];
        return (
          '<div class="species-suggestion" data-index="' +
          i +
          '" role="option">' +
          '<span class="sp-left"><span class="sp-name">' +
          sp.name +
          '</span><span class="sp-sci">' +
          sp.sci +
          "</span></span>" +
          '<span class="sp-meta">' +
          tierBadgeHtml(sp.tier) +
          '<span class="tier-points">' +
          info.points +
          "pt</span></span>" +
          "</div>"
        );
      })
      .join("");
    box.hidden = false;
  }

  function setActive(index) {
    var items = box.querySelectorAll(".species-suggestion");
    items.forEach(function (el, i) {
      el.classList.toggle("active", i === index);
    });
    activeIndex = index;
  }

  input.addEventListener("input", function () {
    renderSuggestions(input.value);
    updateHint();
  });

  input.addEventListener("keydown", function (evt) {
    var items = box.querySelectorAll(".species-suggestion");
    if (box.hidden || !items.length) return;
    if (evt.key === "ArrowDown") {
      evt.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (evt.key === "ArrowUp") {
      evt.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (evt.key === "Enter") {
      if (activeIndex >= 0 && currentMatches[activeIndex]) {
        evt.preventDefault();
        selectSpecies(currentMatches[activeIndex].name);
      }
    } else if (evt.key === "Escape") {
      closeSuggestions();
    }
  });

  box.addEventListener("mousedown", function (evt) {
    var row = evt.target.closest(".species-suggestion");
    if (!row) return;
    var idx = Number(row.getAttribute("data-index"));
    if (currentMatches[idx]) selectSpecies(currentMatches[idx].name);
  });

  document.addEventListener("click", function (evt) {
    if (evt.target !== input && !box.contains(evt.target)) closeSuggestions();
  });

  input.addEventListener("blur", function () {
    // slight delay so a mousedown-selection above still registers first
    setTimeout(updateHint, 0);
  });
});
