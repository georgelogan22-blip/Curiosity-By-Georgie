// Curiosity by Georgie — address lookup for the Registration form's
// residential address fields. Suggests real addresses as the user types,
// using Photon (photon.komoot.io) — a free, keyless geocoding API built on
// OpenStreetMap data, queried straight from the visitor's own browser (no
// address data passes through our servers on the way). Selecting a
// suggestion fills in the suburb, state and postcode fields automatically.
// Typing a manual address always still works — the lookup is a
// convenience, never a requirement, and network hiccups fail quietly.
document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("address-line");
  var box = document.getElementById("address-suggestions");
  var suburbField = document.getElementById("suburb");
  var stateField = document.getElementById("state");
  var postcodeField = document.getElementById("postcode");
  if (!input || !box) return;

  var STATE_NAMES = {
    "queensland": "QLD",
    "new south wales": "NSW",
    "victoria": "VIC",
    "western australia": "WA",
    "south australia": "SA",
    "tasmania": "TAS",
    "australian capital territory": "ACT",
    "northern territory": "NT"
  };

  var activeIndex = -1;
  var currentMatches = [];
  var debounceTimer = null;
  var activeController = null;
  var requestSeq = 0;

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function closeSuggestions() {
    box.hidden = true;
    box.innerHTML = "";
    activeIndex = -1;
    currentMatches = [];
  }

  function mainLine(p) {
    if (p.housenumber && p.street) return p.housenumber + " " + p.street;
    if (p.street) return p.street;
    if (p.name) return p.name;
    return "";
  }

  function subLine(p) {
    var parts = [];
    var locality = p.city || p.district || p.county || "";
    if (locality) parts.push(locality);
    var abbr = STATE_NAMES[(p.state || "").toLowerCase()] || p.state;
    if (abbr) parts.push(abbr);
    if (p.postcode) parts.push(p.postcode);
    return parts.join(" ");
  }

  function selectAddress(props) {
    var street = mainLine(props);
    if (street) input.value = street;
    if (suburbField) {
      var locality = props.city || props.district || props.county || "";
      if (locality) suburbField.value = locality;
    }
    if (stateField) {
      var abbr = STATE_NAMES[(props.state || "").toLowerCase()];
      if (abbr) {
        var hasOption = Array.prototype.some.call(stateField.options, function (o) {
          return o.value === abbr;
        });
        if (hasOption) stateField.value = abbr;
      }
    }
    if (postcodeField && props.postcode) postcodeField.value = props.postcode;
    closeSuggestions();
    input.focus();
  }

  function renderLoading() {
    box.innerHTML = '<div class="no-match">Searching…</div>';
    box.hidden = false;
  }

  function renderError() {
    box.innerHTML = '<div class="no-match">Couldn’t reach address lookup — just type it in.</div>';
    box.hidden = false;
  }

  function renderResults(features) {
    currentMatches = features;
    activeIndex = -1;
    if (!currentMatches.length) {
      box.innerHTML = '<div class="no-match">No matches — just type your address in.</div>';
      box.hidden = false;
      return;
    }
    box.innerHTML = currentMatches
      .map(function (f, i) {
        var p = f.properties || {};
        return (
          '<div class="address-suggestion" data-index="' +
          i +
          '" role="option">' +
          '<span class="addr-main">' +
          escapeHtml(mainLine(p)) +
          "</span>" +
          '<span class="addr-sub">' +
          escapeHtml(subLine(p)) +
          "</span>" +
          "</div>"
        );
      })
      .join("");
    box.hidden = false;
  }

  function setActive(index) {
    var items = box.querySelectorAll(".address-suggestion");
    items.forEach(function (el, i) {
      el.classList.toggle("active", i === index);
    });
    activeIndex = index;
  }

  function fetchSuggestions(query) {
    var seq = ++requestSeq;
    if (activeController) activeController.abort();
    activeController = typeof AbortController !== "undefined" ? new AbortController() : null;
    var url =
      "https://photon.komoot.io/api/?q=" +
      encodeURIComponent(query) +
      "&lat=-27.4698&lon=153.0251&limit=6&lang=en";
    fetch(url, activeController ? { signal: activeController.signal } : {})
      .then(function (res) {
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then(function (data) {
        if (seq !== requestSeq) return;
        var features = (data && data.features) || [];
        features = features.filter(function (f) {
          var cc = f.properties && f.properties.countrycode;
          return !cc || cc === "AU";
        });
        renderResults(features);
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        if (seq !== requestSeq) return;
        renderError();
      });
  }

  input.addEventListener("input", function () {
    var q = input.value.trim();
    clearTimeout(debounceTimer);
    if (q.length < 3) {
      closeSuggestions();
      return;
    }
    renderLoading();
    debounceTimer = setTimeout(function () {
      fetchSuggestions(q);
    }, 350);
  });

  input.addEventListener("keydown", function (evt) {
    var items = box.querySelectorAll(".address-suggestion");
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
        selectAddress(currentMatches[activeIndex].properties || {});
      }
    } else if (evt.key === "Escape") {
      closeSuggestions();
    }
  });

  box.addEventListener("mousedown", function (evt) {
    var row = evt.target.closest(".address-suggestion");
    if (!row) return;
    var idx = Number(row.getAttribute("data-index"));
    if (currentMatches[idx]) selectAddress(currentMatches[idx].properties || {});
  });

  document.addEventListener("click", function (evt) {
    if (evt.target !== input && !box.contains(evt.target)) closeSuggestions();
  });

  input.addEventListener("blur", function () {
    // slight delay so a mousedown-selection above still registers first
    setTimeout(closeSuggestions, 150);
  });
});
