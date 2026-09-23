// Curiosity by Georgie — site search (top-right of the nav bar) and the
// shared "jump to an anchor and flash it" behaviour that both search
// results and plain #hash links use when they land on a section instead
// of the top of a page.
//
// Fully generic: reads SITE_SEARCH_INDEX (assets/search-data.js) plus, when
// present, SPECIES_LIST (assets/species-data.js) to add one entry per bird
// species pointing at its row on the Species Checklist. No page-specific
// code — the same markup (`.nav-search-toggle` / `.nav-search-panel` /
// `.nav-search-input` / `.nav-search-results`) is expected on every page.

(function () {
  "use strict";

  // ---- Build the combined index --------------------------------------
  var INDEX = (typeof SITE_SEARCH_INDEX !== "undefined" ? SITE_SEARCH_INDEX : []).slice();

  if (typeof SPECIES_LIST !== "undefined" && typeof SPECIES_TIERS !== "undefined") {
    SPECIES_LIST.forEach(function (sp) {
      var slug = sp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      var tierInfo = SPECIES_TIERS[sp.tier];
      INDEX.push({
        title: sp.name,
        url: "checklist.html#species-" + slug,
        group: "Species Checklist" + (tierInfo ? " · " + tierInfo.label : ""),
        keywords: sp.sci + (tierInfo ? " " + tierInfo.label : ""),
      });
    });
  }

  var QUICK_LINK_TITLES = ["Rules & Regulations", "Register", "Log a Sighting", "Leaderboard", "Species Checklist"];
  var QUICK_LINKS = QUICK_LINK_TITLES.map(function (t) {
    return INDEX.filter(function (e) { return e.title === t; })[0];
  }).filter(Boolean);

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    var idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, idx)) +
      "<mark>" + escapeHtml(text.slice(idx, idx + query.length)) + "</mark>" +
      escapeHtml(text.slice(idx + query.length))
    );
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return null; // signal: show quick links instead

    var results = [];
    INDEX.forEach(function (entry) {
      var title = entry.title.toLowerCase();
      var score = -1;
      if (title === q) score = 100;
      else if (title.indexOf(q) === 0) score = 80;
      else if (title.indexOf(q) !== -1) score = 60;
      else if (entry.group && entry.group.toLowerCase().indexOf(q) !== -1) score = 45;
      else if (entry.keywords && entry.keywords.toLowerCase().indexOf(q) !== -1) score = 40;
      if (score > -1) results.push({ entry: entry, score: score });
    });

    results.sort(function (a, b) {
      return b.score - a.score || a.entry.title.localeCompare(b.entry.title);
    });

    return results.slice(0, 8).map(function (r) { return r.entry; });
  }

  // ---- Nav search UI ---------------------------------------------------
  function initSearch() {
    var toggle = document.querySelector(".nav-search-toggle");
    var panel = document.querySelector(".nav-search-panel");
    var input = document.querySelector(".nav-search-input");
    var resultsEl = document.querySelector(".nav-search-results");
    if (!toggle || !panel || !input || !resultsEl) return;

    var activeIndex = -1;
    var currentItems = [];

    function closeOtherNavMenus() {
      var links = document.querySelector(".nav-links");
      var navToggle = document.querySelector(".nav-toggle");
      if (links && links.classList.contains("nav-open")) {
        links.classList.remove("nav-open");
        if (navToggle) navToggle.setAttribute("aria-expanded", "false");
      }
      document.querySelectorAll(".nav-more.open").forEach(function (g) {
        g.classList.remove("open");
        var t = g.querySelector(".nav-more-toggle");
        if (t) t.setAttribute("aria-expanded", "false");
      });
    }

    function openPanel() {
      closeOtherNavMenus();
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-expanded", "true");
      input.focus();
      render(QUICK_LINKS, true);
    }

    function closePanel() {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    }

    function isOpen() {
      return !panel.hidden;
    }

    function render(items, isQuickLinks) {
      currentItems = items || [];
      activeIndex = -1;

      if (!currentItems.length) {
        resultsEl.innerHTML = '<li class="nav-search-empty">No matches — try a page name, a rule, or a species.</li>';
        return;
      }

      var query = isQuickLinks ? "" : input.value.trim();
      var heading = isQuickLinks
        ? '<li class="nav-search-group-label">Jump to</li>'
        : "";

      resultsEl.innerHTML = heading + currentItems
        .map(function (entry, i) {
          return (
            '<li role="option" id="nav-search-opt-' + i + '" data-index="' + i + '">' +
            '<a href="' + escapeHtml(entry.url) + '" tabindex="-1">' +
            '<span class="nav-search-result-title">' + highlight(entry.title, query) + "</span>" +
            '<span class="nav-search-result-group">' + escapeHtml(entry.group || "") + "</span>" +
            "</a></li>"
          );
        })
        .join("");
    }

    function setActive(i) {
      var options = resultsEl.querySelectorAll("li[role='option']");
      options.forEach(function (li) { li.removeAttribute("aria-selected"); });
      if (i >= 0 && i < options.length) {
        options[i].setAttribute("aria-selected", "true");
        options[i].scrollIntoView({ block: "nearest" });
        input.setAttribute("aria-activedescendant", options[i].id);
      } else {
        input.removeAttribute("aria-activedescendant");
      }
      activeIndex = i;
    }

    function go(entry) {
      if (!entry) return;
      var hashIdx = entry.url.indexOf("#");
      var page = hashIdx === -1 ? entry.url : entry.url.slice(0, hashIdx);
      var hash = hashIdx === -1 ? "" : entry.url.slice(hashIdx + 1);
      var samePage =
        page === location.pathname.split("/").pop() ||
        (page === "index.html" && (location.pathname === "/" || location.pathname.endsWith("/")));

      closePanel();
      input.value = "";

      if (samePage && hash) {
        history.pushState(null, "", "#" + hash);
        jumpToAnchor(hash);
      } else {
        window.location.href = entry.url;
      }
    }

    toggle.addEventListener("click", function () {
      if (isOpen()) closePanel();
      else openPanel();
    });

    input.addEventListener("input", function () {
      var items = search(input.value);
      render(items === null ? QUICK_LINKS : items, items === null);
    });

    input.addEventListener("keydown", function (e) {
      var count = currentItems.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (count) setActive((activeIndex + 1) % count);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (count) setActive((activeIndex - 1 + count) % count);
      } else if (e.key === "Enter") {
        e.preventDefault();
        var chosen = activeIndex >= 0 ? currentItems[activeIndex] : currentItems[0];
        go(chosen);
      } else if (e.key === "Escape") {
        closePanel();
        toggle.focus();
      }
    });

    resultsEl.addEventListener("click", function (e) {
      var li = e.target.closest("li[role='option']");
      if (!li) return;
      e.preventDefault();
      go(currentItems[Number(li.dataset.index)]);
    });

    document.addEventListener("click", function (e) {
      if (!isOpen()) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      closePanel();
    });

    // "/" opens search from anywhere on the page, unless the person is
    // already typing somewhere else (a form field, the chat box, etc).
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || isOpen()) return;
      var el = document.activeElement;
      var typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      openPanel();
    });
  }

  // ---- Shared "jump to #hash and flash it" behaviour --------------------
  // Used for search results landing on the page they're already on, for a
  // fresh page load that arrives with a #hash (a search result on another
  // page, or any plain link), and for in-page anchor links generally.
  function jumpToAnchor(hash) {
    if (!hash) return;
    var target;
    try {
      target = document.getElementById(hash);
    } catch (err) {
      target = null;
    }
    if (!target) return;

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Add the class (it carries scroll-margin-top, so the sticky nav bar
    // doesn't cover the target) *before* scrolling, not after — scrollIntoView
    // reads scroll-margin at the moment it's called.
    target.classList.add("search-target-highlight");
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    window.setTimeout(function () {
      target.classList.remove("search-target-highlight");
    }, 2200);
  }
  window.CGJumpToAnchor = jumpToAnchor;

  document.addEventListener("DOMContentLoaded", function () {
    initSearch();
    if (location.hash) jumpToAnchor(location.hash.slice(1));
  });

  window.addEventListener("hashchange", function () {
    if (location.hash) jumpToAnchor(location.hash.slice(1));
  });
})();
