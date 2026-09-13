// Shared mobile nav: turns the top nav bar's link list into a collapsible
// dropdown below the "hamburger" toggle button on narrow screens. Same
// markup (`.nav-toggle` button + `.nav-links` list) appears on every page,
// so this one small script works everywhere without any page-specific code.
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  function closeMenu() {
    links.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }
  function openMenu() {
    links.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
  }

  toggle.addEventListener("click", function () {
    if (links.classList.contains("nav-open")) closeMenu();
    else openMenu();
  });

  // Close the menu once a link is chosen — handles both a real page
  // navigation and the hosted preview's hash-based single-page routing,
  // where clicking a link doesn't unload the page at all.
  links.addEventListener("click", function (e) {
    if (e.target.closest("a")) closeMenu();
  });

  // Tapping/clicking anywhere outside the open menu closes it.
  document.addEventListener("click", function (e) {
    if (!links.classList.contains("nav-open")) return;
    if (links.contains(e.target) || toggle.contains(e.target)) return;
    closeMenu();
  });

  // If the window is resized back past the mobile breakpoint (e.g.
  // rotating a tablet, or a desktop browser being resized), don't leave
  // the menu stuck open with the wrong layout underneath it.
  window.addEventListener("resize", function () {
    if (window.innerWidth > 1200) closeMenu();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });
})();

// Desktop nav dropdowns: on wide screens, related links group behind a
// small toggle button instead of being spelled out in the bar — "The
// Brisbane 250" (Air 50, plus each discipline still to come), "Sightings"
// (Log a Sighting, My Sightings), "Species Checklist" (one entry per
// discipline), and "More" (Chat, Merchandise) — so the bar stays tidy as
// more challenge variants add more pages down the line. Works generically
// over every ".nav-more" group on the page, so adding another dropdown
// later needs no script change. Below the mobile breakpoint every group is
// flattened back into the plain hamburger list by CSS, and the toggle
// buttons are hidden, so this script is a no-op there.
(function () {
  var groups = Array.prototype.slice.call(document.querySelectorAll(".nav-more"));
  if (!groups.length) return;

  function closeGroup(group) {
    var toggle = group.querySelector(".nav-more-toggle");
    group.classList.remove("open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
  function closeAll(except) {
    groups.forEach(function (g) {
      if (g !== except) closeGroup(g);
    });
  }

  groups.forEach(function (group) {
    var toggle = group.querySelector(".nav-more-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = group.classList.contains("open");
      closeAll(group);
      if (isOpen) closeGroup(group);
      else {
        group.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    // Close once a link inside the dropdown is chosen (matters for the
    // hosted preview's hash-based routing, where a click doesn't unload
    // the page at all).
    group.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeGroup(group);
    });
  });

  document.addEventListener("click", function (e) {
    groups.forEach(function (group) {
      if (group.classList.contains("open") && !group.contains(e.target)) closeGroup(group);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAll(null);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth <= 1200) closeAll(null);
  });
})();
