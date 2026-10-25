// Pre-launch lockdown gate — prototype, 2026-10-25. Dates confirmed 2026-10-25,
// lockdown start date revised 2026-10-25.
//
// What this does: from 3 November 2026, every page on the site except
// Rules and Register redirects to countdown.html. On launch day itself
// (16 November 2026, 5:00 AM Brisbane time), the whole site opens back up
// automatically — nothing to flip by hand at launch time.
//
// How the timing works: LOCKDOWN_START and LAUNCH_DATE below are fixed
// instants in time (the +10:00 offset is Brisbane/Queensland's permanent
// UTC offset — QLD doesn't observe daylight saving, so this never drifts).
// Every visitor's browser compares its own "now" against those two fixed
// instants, so the transition happens for everyone at the same real-world
// moment, regardless of their own device clock's timezone setting.
//
// This is a soft, client-side gate — exactly the same kind of pre-launch
// measure already used elsewhere on the site (e.g. register.html's
// "Not Yet Open" notice), not a security boundary. It only hides pages
// from casual browsing; it doesn't touch what's actually readable via a
// direct Supabase call, which was never the goal. The one place that
// *does* need a real backend-side lock is registration actually accepting
// sign-ups — that's still controlled separately (Supabase's
// `revoke/grant insert on public.participants`), on purpose, since it's
// tied to the legal review clearing rather than to a date. See
// countdown.html and the project notes for more on that split.
(function () {
  "use strict";

  // ---- Single source of truth for the lockdown window ----
  // Confirmed by George, 2026-10-25: full lockdown for everyone (no
  // exceptions beyond Rules/Register/Countdown — Contact included) starts
  // 3 November 2026; launch is 16 November 2026 at 5:00 AM Brisbane time.
  var LOCKDOWN_START = new Date("2026-11-03T00:00:00+10:00");
  var LAUNCH_DATE     = new Date("2026-11-16T05:00:00+10:00"); // confirmed launch date + time

  // Pages the public can still reach once the lockdown window starts.
  var ALLOWED_DURING_LOCKDOWN = ["rules.html", "register.html", "countdown.html"];

  function currentPage() {
    var p = location.pathname.split("/").pop();
    return p === "" ? "index.html" : p;
  }

  function computePhase() {
    var now = new Date();
    if (now >= LAUNCH_DATE) return "live";
    if (now >= LOCKDOWN_START) return "countdown";
    return "preview";
  }

  var PHASE = computePhase();

  // Exposed so countdown.html's own script (the ticking timer) can read
  // the same dates without re-declaring them, and so this is easy to
  // sanity-check from the browser console while testing.
  window.CG_LOCKDOWN = { phase: PHASE, launchDate: LAUNCH_DATE, lockdownStart: LOCKDOWN_START };

  // ---- 1. Redirect disallowed pages to the countdown screen ----
  if (PHASE === "countdown" && ALLOWED_DURING_LOCKDOWN.indexOf(currentPage()) === -1) {
    location.replace("countdown.html");
    return;
  }

  // ---- 2. Once launch has actually happened, don't leave a stale
  //         countdown screen showing to anyone who still has it open or
  //         bookmarked — send them into the real, now-open site.
  if (PHASE === "live" && currentPage() === "countdown.html") {
    location.replace("index.html");
    return;
  }

  // ---- 3. Trim the shared nav down to Rules + Register while locked ----
  // Runs on the handful of pages that stay reachable during the
  // "countdown" phase, so visitors there aren't shown links to pages that
  // would just bounce them straight back here. Works generically off each
  // link's href, so it needs no per-page markup changes.
  function trimNav() {
    if (PHASE !== "countdown") return;

    // The logo normally links home; home is locked too during this
    // window, so point it at the countdown screen instead of a page that
    // would just redirect again.
    var brand = document.querySelector(".site-nav .brand");
    if (brand) brand.setAttribute("href", "countdown.html");

    // Hide the site search while locked down — it can surface pages
    // (species, leaderboard, etc.) that are off-limits right now.
    var search = document.querySelector(".nav-search");
    if (search) search.style.display = "none";

    document.querySelectorAll(".nav-links .nav-more").forEach(function (group) {
      var anyVisible = false;
      group.querySelectorAll("a[href]").forEach(function (a) {
        var href = a.getAttribute("href").split(/[?#]/)[0];
        var li = a.closest("li");
        if (ALLOWED_DURING_LOCKDOWN.indexOf(href) === -1) {
          if (li) li.style.display = "none";
        } else {
          anyVisible = true;
        }
      });
      group.style.display = anyVisible ? "" : "none";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trimNav);
  } else {
    trimNav();
  }
})();
