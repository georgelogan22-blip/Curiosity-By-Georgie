// Curiosity by Georgie — site search index.
//
// Static, hand-curated list of pages and in-page sections the top-right
// search box can jump to. Deliberately plain data (no build step): add a
// page or a rules section here and it's searchable everywhere, since every
// page loads this file. Species entries are NOT listed here — search.js
// generates those at runtime from SPECIES_LIST (assets/species-data.js),
// so the Species Checklist stays the one source of truth for bird names.
var SITE_SEARCH_INDEX = [
  // Pages
  { title: "The Brisbane Air 50", url: "index.html", group: "The Brisbane 250", keywords: "home air 50 brisbane air 50 how it works overview" },
  { title: "Rules & Regulations", url: "rules.html", group: "Rules & Checklist", keywords: "rules regulations how it works" },
  { title: "Species Checklist", url: "checklist.html", group: "Rules & Checklist", keywords: "checklist species list tiers points fifty 50 birds" },
  { title: "Register", url: "register.html", group: "Participate", keywords: "register sign up signup create account join" },
  { title: "Log a Sighting", url: "log-sighting.html", group: "Participate", keywords: "log sighting submit report a bird photo sick injured dead bird emergency hotline rspca wildcare bird flu" },
  { title: "My Sightings", url: "my-sightings.html", group: "Participate", keywords: "my sightings status pending approved history" },
  { title: "Leaderboard", url: "leaderboard.html", group: "Community", keywords: "leaderboard ranking rankings points standings who's winning" },
  { title: "Hall of Fame", url: "hall-of-fame.html", group: "Community", keywords: "hall of fame finishers completed fifty and beyond" },
  { title: "Curiosity Chat", url: "chat.html", group: "Community", keywords: "chat chatty curiosity community board posts discussion" },
  { title: "Finisher Rewards", url: "finisher-rewards.html", group: "More", keywords: "finisher rewards coin finisher's coin medal prize reward merchandise air master reveal limited scarce first 50 fifty" },
  { title: "Forgot Your PIN", url: "forgot-pin.html", group: "Account", keywords: "forgot pin reset password recover account" },

  // Rules & Regulations — sections
  { title: "Safety First", url: "rules.html#safety-first", group: "Rules & Regulations", keywords: "safety rule 1" },
  { title: "Registration & Liability", url: "rules.html#registration", group: "Rules & Regulations", keywords: "registration liability required to play risk assumption removal ban" },
  { title: "Your Privacy", url: "register.html#privacy", group: "Register", keywords: "privacy data personal information what's collected what's public" },
  { title: "The Challenge", url: "rules.html#the-challenge", group: "Rules & Regulations", keywords: "challenge overview fifty species no deadline" },
  { title: "Who Can Play", url: "rules.html#who-can-play", group: "Rules & Regulations", keywords: "who can play eligibility anyone" },
  { title: "The Boundary", url: "rules.html#the-boundary", group: "Rules & Regulations", keywords: "boundary greater brisbane moreton bay redlands logan ipswich d'aguilar map area" },
  { title: "What Counts", url: "rules.html#what-counts", group: "Rules & Regulations", keywords: "what counts as a sighting valid species" },
  { title: "How To Log It", url: "rules.html#how-to-log-it", group: "Rules & Regulations", keywords: "how to log a sighting submitting photo proof" },
  { title: "Verification & Launch Date", url: "rules.html#verification", group: "Rules & Regulations", keywords: "verification launch date official start" },
  { title: "Leaderboard & Hall of Fame (rules)", url: "rules.html#leaderboard-hall-of-fame", group: "Rules & Regulations", keywords: "leaderboard hall of fame rules how points work" },
  { title: "Fair Play", url: "rules.html#fair-play", group: "Rules & Regulations", keywords: "fair play cheating disqualified honesty" },

  // Species Checklist — sections
  { title: "Species Checklist — by tier", url: "checklist.html#checklist-sections", group: "Species Checklist", keywords: "checklist tiers abundant common uncommon rare special legendary" },
  { title: "Research Resources", url: "checklist.html#research-resources", group: "Species Checklist", keywords: "research resources ebird birdlife australia birds queensland wader study group inaturalist" },
];
