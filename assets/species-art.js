// Curiosity by Georgie — Species Dex artwork + facts (My Sightings page)
//
// Keyed by the SAME lowercased/trimmed species name used everywhere else
// (see SPECIES_BY_KEY in species-data.js), so my-sightings.js can look up
// SPECIES_ART[key] for any confirmed species without a second normalisation
// scheme. Each entry is:
//   {
//     svg: "<svg>...</svg>",       // badge/thumbnail art for the Dex grid cell
//     photo: "assets/species-photos/....png",   // OPTIONAL real photo/illustration
//                                                // for the flip-card front — falls
//                                                // back to `svg` when absent
//     stats: { weight, length, wingspan, footprint },  // OPTIONAL "trading card" stat block
//     facts: ["...", "...", "..."],
//   }
//
// The <svg> MUST wrap every bird shape in a single <g class="dex-bird">
// (plus an outer background circle+ring left OUTSIDE that group) — the Dex
// grid's CSS flattens whatever is inside .dex-bird to a solid silhouette
// with a brightness(0) filter until the sighting is confirmed, then
// animates it back to full colour. This is why a locked bird can look like
// a silhouette and a revealed one can look fully illustrated using the
// exact same markup — no separate silhouette artwork needed. `photo`, if
// present, is only ever shown AFTER a sighting is confirmed (the flip-card
// front) — it's never put through the silhouette filter.
//
// STATUS (2026-10-13): hand-illustrated + fact-checked for 8 species so
// far, reusing the Hall of Fame badge art line-for-line for the 4 species
// that already had it (Willie Wagtail, Rainbow Lorikeet, Galah, Australian
// Pelican), built fresh in the same style for 4 more. The other 42 render
// fine today via the Dex's generic placeholder bird (see genericDexSvg() in
// my-sightings.js) — they just show name/tier/sci-name once confirmed,
// with a "coming soon" note instead of stats/facts, until art+facts are
// added here. Add a new entry below (lowercase species name as the key)
// and it picks up automatically — no other file needs to change.
//
// Facts are written for general public accuracy, not reproduced from any
// single source — recheck before publishing anything genuinely contested.
// Stats are sourced from Wikipedia species pages + a couple of supporting
// field-guide sources checked 2026-10-13; two are flagged as estimates
// below because a wingspan figure isn't well documented for that species —
// worth a field-guide spot-check before this goes live.

var SPECIES_ART = {
  "torresian crow": {
    // George's own fully-designed trading card (front + back), species
    // #1/50 — when `card` is present, the flip-card detail view shows
    // these two images edge-to-edge instead of the auto-built stat-grid
    // + facts layout (see wireDex() in my-sightings.js). The small `svg`
    // badge below is unaffected — it's still what the Dex GRID cell shows
    // and what the locked-silhouette filter uses.
    card: {
      front: "assets/species-cards/torresian-crow-front.jpg",
      back: "assets/species-cards/torresian-crow-back.jpg"
    },
    // Grid-cell badge: George's own Torresian Crow illustration, used as the
    // Dex thumbnail instead of the old flat-colour schematic above. It's
    // still wrapped in the standard ring-circle + <g class="dex-bird"> shape
    // so the locked-silhouette CSS filter and reveal animation apply to it
    // exactly like every hand-drawn svg badge — clipped to a circle so it
    // reads as one consistent badge shape across the grid.
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Torresian Crow">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="#1b2a1f" stroke="var(--accent-warm)" stroke-width="3"/>' +
      "<defs><clipPath id=\"crowBadgeClip\"><circle cx=\"50\" cy=\"50\" r=\"46\"/></clipPath></defs>" +
      '<g class="dex-bird" clip-path="url(#crowBadgeClip)">' +
      '<image href="assets/species-photos/torresian-crow-badge.png" x="4" y="4" width="92" height="92" preserveAspectRatio="xMidYMid slice"/>' +
      "</g></svg>",
    stats: {
      weight: "430–670 g",
      length: "48–53 cm",
      wingspan: "~90 cm (estimated)",
      footprint: "Anisodactyl — 3 toes forward, 1 back; confident ground-walker"
    },
    facts: [
      "They're one of the only all-black birds you'll see around Brisbane with pale, almost white eyes as adults — a handy trick for telling them apart from ravens at a glance.",
      "Torresian Crows are confident ground-feeders, often seen walking rather than hopping across lawns and car parks, probing for insects, scraps and carrion.",
      "Their call is a deep, nasal \"uk-uk-uk\" — flatter and more guttural than the drawn-out, wailing \"aaah-aaah-aaaah\" of an Australian Raven, so you can often tell them apart by ear before you spot them."
    ]
  },

  "willie wagtail": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Willie Wagtail">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="#eceae4" stroke="var(--accent-warm)" stroke-width="3"/>' +
      '<g class="dex-bird">' +
      '<ellipse cx="48" cy="58" rx="18" ry="15" fill="#1c1c1c"/>' +
      '<circle cx="36" cy="46" r="11" fill="#1c1c1c"/>' +
      '<path d="M60,60 Q84,52 90,68 Q84,80 62,72 Q72,64 60,60 Z" fill="#1c1c1c"/>' +
      '<path d="M25,45 L12,42 L25,50 Z" fill="#3a3a3a"/>' +
      '<circle cx="33" cy="43" r="2.2" fill="#f4f4f0"/>' +
      '<path d="M28,56 Q36,66 46,60" fill="none" stroke="#f4f4f0" stroke-width="4" stroke-linecap="round"/>' +
      "</g></svg>",
    stats: {
      weight: "17–24 g",
      length: "19–21.5 cm",
      wingspan: "~25 cm (estimated)",
      footprint: "Anisodactyl — tiny perching foot, rarely still for long"
    },
    facts: [
      "That constant side-to-side tail wag isn't idle fidgeting — it's thought to help flush insects out of the grass so the bird can snap them up the moment they move.",
      "It's Australia's largest fantail, and easily one of the boldest — Willie Wagtails are famous for harassing birds many times their size, kookaburras and even eagles, that stray too close to the nest.",
      "Its scratchy \"chit-chit-chit-cheerily-cheerup\" song is one of the few Australian bird calls you'll regularly hear at night, especially under streetlights or a full moon."
    ]
  },

  "rainbow lorikeet": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Rainbow Lorikeet">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="#eaf3ea" stroke="var(--accent-warm)" stroke-width="3"/>' +
      '<g class="dex-bird">' +
      '<ellipse cx="52" cy="60" rx="23" ry="19" fill="#2f8f4e"/>' +
      '<circle cx="38" cy="44" r="13" fill="#2b4fa0"/>' +
      '<path d="M32,34 Q38,20 48,26 Q40,30 36,40 Z" fill="#c9c9c9"/>' +
      '<path d="M60,50 Q76,52 80,64 Q68,68 58,62 Z" fill="#e8ac5e"/>' +
      '<path d="M25,42 L10,39 L25,49 Z" fill="#8a8a8a"/>' +
      '<circle cx="35" cy="40" r="2.4" fill="#172621"/>' +
      '<ellipse cx="44" cy="66" rx="10" ry="6" fill="#d9652e"/>' +
      "</g></svg>",
    stats: {
      weight: "75–157 g",
      length: "25–30 cm",
      wingspan: "~46 cm",
      footprint: "Zygodactyl — 2 toes forward, 2 back; strong climbing/clinging grip"
    },
    facts: [
      "That rainbow plumage isn't just for show — lorikeets have a specialised brush-tipped tongue built for mopping up nectar and pollen from flowering eucalypts and grevilleas.",
      "They're almost never alone. Rainbow Lorikeets travel in fast, screeching flocks and tend to pair for life, roosting wing-to-wing with the same partner night after night.",
      "Brisbane's lorikeets are genuinely nomadic within the city — flocks will shift from suburb to suburb over the weeks, simply following whichever street trees happen to be flowering."
    ]
  },

  "australian magpie": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Australian Magpie">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="#eef3ea" stroke="var(--accent-warm)" stroke-width="3"/>' +
      '<g class="dex-bird">' +
      '<ellipse cx="52" cy="63" rx="23" ry="18" fill="#16171a"/>' +
      '<circle cx="36" cy="46" r="12" fill="#16171a"/>' +
      '<path d="M33,35 Q54,25 64,42 Q52,53 33,47 Z" fill="#f4f4f0"/>' +
      '<path d="M62,55 Q83,50 89,67 Q74,77 60,67 Z" fill="#16171a"/>' +
      '<path d="M80,58 Q89,62 87,69 Q78,69 78,62 Z" fill="#f4f4f0"/>' +
      '<path d="M25,44 L11,41 L25,50 Z" fill="#2a2a2a"/>' +
      '<circle cx="33" cy="43" r="3.2" fill="#f4f4f0"/>' +
      '<circle cx="33" cy="43" r="1.7" fill="#111"/>' +
      "</g></svg>",
    stats: {
      weight: "220–350 g",
      length: "37–43 cm",
      wingspan: "65–85 cm",
      footprint: "Anisodactyl — walks with a confident, direct stride (doesn't hop)"
    },
    facts: [
      "Magpies are among the most intelligent birds in the world — studies have shown individuals can recognise and remember dozens of different human faces, for years at a time.",
      "Their rich, warbling carol is produced by two independent voice boxes, letting a single bird layer two notes at once — part of why a dawn chorus of magpies sounds so layered and complex.",
      "Spring swooping is almost always a male defending a nest within roughly 50 to 100 metres of it, and it reliably stops within a few weeks, once the chicks have fledged."
    ]
  },

  "laughing kookaburra": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Laughing Kookaburra">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="#f3ece0" stroke="var(--accent-warm)" stroke-width="3"/>' +
      '<g class="dex-bird">' +
      '<ellipse cx="54" cy="64" rx="24" ry="17" fill="#7a5a3a"/>' +
      '<path d="M58,52 Q75,45 81,58 Q68,65 58,60 Z" fill="#3a6ea5"/>' +
      '<circle cx="37" cy="43" r="15" fill="#e9e2d0"/>' +
      '<path d="M20,43 L46,39 L46,45 L20,47 Z" fill="#4a3625"/>' +
      '<path d="M21,41 L2,37 Q0,44 2,51 L21,47 Z" fill="#2b2320"/>' +
      '<circle cx="30" cy="41" r="3" fill="#e9e2d0"/>' +
      '<circle cx="30" cy="41" r="1.7" fill="#15110c"/>' +
      "</g></svg>",
    stats: {
      weight: "200–465 g",
      length: "41–47 cm",
      wingspan: "~64–66 cm",
      footprint: "Syndactyl — front toes partly fused, typical of the kingfisher family"
    },
    facts: [
      "That iconic cackling call is almost never a lone bird — it's usually a family group calling together to mark their territory, often answered right back by a neighbouring family further off.",
      "Kookaburras are kingfishers that rarely eat fish. Around Brisbane they mostly hunt insects, lizards, mice and even small snakes, killing prey by bashing it hard against a branch.",
      "Chicks hatch with a small hooked, backward-pointing tip on the beak that helps the oldest sibling in the nest fend off younger ones — it wears away within the first couple of weeks."
    ]
  },

  "galah": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Galah">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="#f6ecec" stroke="var(--accent-warm)" stroke-width="3"/>' +
      '<g class="dex-bird">' +
      '<ellipse cx="52" cy="60" rx="23" ry="19" fill="#d98fa3"/>' +
      '<circle cx="38" cy="44" r="13" fill="#d98fa3"/>' +
      '<path d="M32,34 Q38,20 48,26 Q40,30 36,40 Z" fill="#c9c9c9"/>' +
      '<path d="M60,50 Q76,52 80,64 Q68,68 58,62 Z" fill="#c9c9c9"/>' +
      '<path d="M25,42 L10,39 L25,49 Z" fill="#8a8a8a"/>' +
      '<circle cx="35" cy="40" r="2.4" fill="#172621"/>' +
      "</g></svg>",
    stats: {
      weight: "270–400 g",
      length: "~35 cm",
      wingspan: "~75 cm",
      footprint: "Zygodactyl — 2 toes forward, 2 back; typical cockatoo grip"
    },
    facts: [
      "That soft grey-and-pink colouring hides a clue to sex you can spot from the ground — adult males have dark brown eyes, while females develop a distinctive pinkish-red eye.",
      "Galahs mate for life and famously \"dance\" during courtship — bobbing, bowing and raising their crest to impress a partner.",
      "They're one of the few cockatoos regularly seen simply playing — wildlife watchers often report Galahs swinging on wires or hanging upside down from branches for no obvious reason beyond fun."
    ]
  },

  "sulphur-crested cockatoo": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Sulphur-crested Cockatoo">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="#eef0ea" stroke="var(--accent-warm)" stroke-width="3"/>' +
      '<g class="dex-bird">' +
      '<ellipse cx="52" cy="62" rx="22" ry="18" fill="#f7f6ef"/>' +
      '<path d="M58,50 Q74,48 78,60 Q66,66 58,58 Z" fill="#e6e4da"/>' +
      '<circle cx="37" cy="45" r="12" fill="#f7f6ef"/>' +
      '<path d="M30,32 Q25,13 40,16 Q33,26 38,34 Z" fill="#f3d64e"/>' +
      '<path d="M36,30 Q36,13 48,18 Q40,26 42,34 Z" fill="#f0c93a"/>' +
      '<path d="M25,46 L10,43 L25,52 Z" fill="#2c2c2c"/>' +
      '<circle cx="34" cy="43" r="3.4" fill="#dfeaf0"/>' +
      '<circle cx="34" cy="43" r="1.9" fill="#1a1a1a"/>' +
      "</g></svg>",
    // Real photo (George's own reference image) for the flip card's front.
    // The small badge SVG above still carries the Dex grid thumbnail + the
    // locked silhouette, since brightness(0) filtering needs that <g
    // class="dex-bird"> structure — photo is only ever shown post-reveal.
    photo: "assets/species-photos/sulphur-crested-cockatoo.png",
    stats: {
      weight: "815–975 g",
      length: "44–55 cm",
      wingspan: "~90–103 cm",
      footprint: "Zygodactyl — 2 toes forward, 2 back; strong grey scaled foot"
    },
    facts: [
      "Their yellow crest usually lies flat against the head and only snaps upright when the bird is alarmed, excited, or landing — it's basically a mood indicator you can read from the ground.",
      "Sulphur-crested Cockatoos can live 40-plus years in the wild and well past 60 in captivity, so the noisy bird in a backyard tree might genuinely be older than the person watching it.",
      "They're notorious problem-solvers — flocks in parts of Australia have been documented learning, and then passing on to neighbouring flocks, the exact technique for flipping open wheelie-bin lids."
    ]
  },

  "australian pelican": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Australian Pelican">' +
      '<circle cx="50" cy="50" r="48" class="dex-ring" fill="#e9eef4" stroke="var(--accent-warm)" stroke-width="3"/>' +
      '<g class="dex-bird">' +
      '<ellipse cx="54" cy="62" rx="24" ry="18" fill="#fbfaf3"/>' +
      '<circle cx="36" cy="46" r="12" fill="#fbfaf3"/>' +
      '<path d="M25,44 L2,40 Q10,50 2,56 L25,52 Z" fill="#e8ac5e"/>' +
      '<path d="M25,44 L2,40 Q10,44 2,48 L25,48 Z" fill="#d98a3a"/>' +
      '<circle cx="33" cy="41" r="2.2" fill="#172621"/>' +
      '<path d="M56,46 Q70,40 74,52 Q64,56 56,50 Z" fill="#1f5fa8"/>' +
      "</g></svg>",
    stats: {
      weight: "4.5–7.7 kg (up to ~13 kg for very large males)",
      length: "152–188 cm",
      wingspan: "230–260 cm",
      footprint: "Totipalmate — all 4 toes fully webbed, built for powerful swimming"
    },
    facts: [
      "Its bill is the largest of any living bird — up to half a metre long — and the stretchy throat pouch underneath holds several litres, used for scooping and draining water rather than for storing food.",
      "Pelicans often fish cooperatively, forming a line or horseshoe shape on the water to herd fish into the shallows where they're easier to scoop up.",
      "They're powerful gliders that ride thermals up to altitudes of over 1,000 metres, sometimes covering hundreds of kilometres between wetlands in a single day as conditions change."
    ]
  }
};
