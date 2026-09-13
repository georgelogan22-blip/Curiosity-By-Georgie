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
    if (window.innerWidth > 780) closeMenu();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });
})();

// Desktop "More" dropdown: on wide screens, secondary nav links (Register,
// Log a Sighting, My Sightings, Species Checklist) live behind a small
// "More" button instead of being spelled out in the bar, so the bar stays
// tidy as more challenge variants add more pages down the line. Below the
// mobile breakpoint this group is flattened back into the plain hamburger
// list by CSS, and the toggle button is hidden, so this script is a no-op
// there.
(function () {
  var more = document.querySelector(".nav-more");
  var moreToggle = document.querySelector(".nav-more-toggle");
  if (!more || !moreToggle) return;

  function closeMore() {
    more.classList.remove("open");
    moreToggle.setAttribute("aria-expanded", "false");
  }
  function openMore() {
    more.classList.add("open");
    moreToggle.setAttribute("aria-expanded", "true");
  }

  moreToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    if (more.classList.contains("open")) closeMore();
    else openMore();
  });

  // Close once a link inside the dropdown is chosen (matters for the
  // hosted preview's hash-based routing, where a click doesn't unload
  // the page at all).
  more.addEventListener("click", function (e) {
    if (e.target.closest("a")) closeMore();
  });

  document.addEventListener("click", function (e) {
    if (!more.classList.contains("open")) return;
    if (more.contains(e.target)) return;
    closeMore();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMore();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth <= 780) closeMore();
  });
})();

