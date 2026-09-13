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
