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
    // Dex thumbnail instead of the old flat-colour schematic above. No ring
    // (George wants the whole bird, not a cropped badge) — but inset with
    // the same ~12% margin every schematic icon has around its drawn bird,
    // so the photo reads at the same visual "size" as every other cell
    // instead of bleeding to the edges. "Meet" keeps the full image inside
    // that inset box with nothing cut off, wrapped in the standard
    // <g class="dex-bird"> so the locked-silhouette CSS filter and reveal
    // animation still apply to it exactly like every hand-drawn svg badge.
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Torresian Crow">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/torresian-crow-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>",
    stats: {
      weight: "430–670 g",
      length: "48–53 cm",
      wingspan: "~95–100 cm (estimated)",
      footprint: "Anisodactyl — 3 toes forward, 1 back; confident ground-walker"
    },
    facts: [
      "They're one of the only all-black birds you'll see around Brisbane with pale, almost white eyes as adults — a handy trick for telling them apart from ravens at a glance.",
      "Torresian Crows are confident ground-feeders, often seen walking rather than hopping across lawns and car parks, probing for insects, scraps and carrion.",
      "Their call is a deep, nasal \"uk-uk-uk\" — flatter and more guttural than the drawn-out, wailing \"aaah-aaah-aaaah\" of an Australian Raven, so you can often tell them apart by ear before you spot them."
    ]
  },

  "willie wagtail": {
    // George's own fully-designed trading card (front + back), species #8/50.
    card: {
      front: "assets/species-cards/willie-wagtail-front.jpg",
      back: "assets/species-cards/willie-wagtail-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Willie Wagtail">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/willie-wagtail-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
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
    // George's own fully-designed trading card (front + back), species #3/50.
    card: {
      front: "assets/species-cards/rainbow-lorikeet-front.jpg",
      back: "assets/species-cards/rainbow-lorikeet-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Rainbow Lorikeet">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/rainbow-lorikeet-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
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
    // George's own fully-designed trading card (front + back), species #4/50.
    card: {
      front: "assets/species-cards/australian-magpie-front.jpg",
      back: "assets/species-cards/australian-magpie-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Australian Magpie">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/australian-magpie-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
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
    // George's own fully-designed trading card (front + back), species #12/50.
    card: {
      front: "assets/species-cards/laughing-kookaburra-front.jpg",
      back: "assets/species-cards/laughing-kookaburra-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Laughing Kookaburra">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/laughing-kookaburra-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
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
    // George's own fully-designed trading card (front + back), species #21/50.
    card: {
      front: "assets/species-cards/galah-front.jpg",
      back: "assets/species-cards/galah-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Galah">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/galah-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
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
    // George's own fully-designed trading card (front + back), species #16/50.
    card: {
      front: "assets/species-cards/sulphur-crested-cockatoo-front.jpg",
      back: "assets/species-cards/sulphur-crested-cockatoo-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Sulphur-crested Cockatoo">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/sulphur-crested-cockatoo-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
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
    // George's own fully-designed trading card (front + back), species #24/50.
    card: {
      front: "assets/species-cards/australian-pelican-front.jpg",
      back: "assets/species-cards/australian-pelican-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Australian Pelican">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/australian-pelican-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
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
  },

  // --- New species art added 2026-10-15: George's own AI-illustrated badge
  // art for the remaining species. Thumbnail-only for now (svg field) — stats
  // and facts for these are still coming, so each entry falls back to the Dex's
  // "coming soon" note until those are added, same as the mechanic above describes.
  "noisy miner": {
    // George's own fully-designed trading card (front + back), species #2/50.
    card: {
      front: "assets/species-cards/noisy-miner-front.jpg",
      back: "assets/species-cards/noisy-miner-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Noisy Miner">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/noisy-miner-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "welcome swallow": {
    // George's own fully-designed trading card (front + back), species #5/50.
    card: {
      front: "assets/species-cards/welcome-swallow-front.jpg",
      back: "assets/species-cards/welcome-swallow-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Welcome Swallow">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/welcome-swallow-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "australian white ibis": {
    // George's own fully-designed trading card (front + back), species #6/50.
    card: {
      front: "assets/species-cards/australian-white-ibis-front.jpg",
      back: "assets/species-cards/australian-white-ibis-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Australian White Ibis">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/australian-white-ibis-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "magpie-lark": {
    // George's own fully-designed trading card (front + back), species #7/50.
    card: {
      front: "assets/species-cards/magpie-lark-front.jpg",
      back: "assets/species-cards/magpie-lark-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Magpie-lark">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/magpie-lark-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "grey butcherbird": {
    // George's own fully-designed trading card (front + back), species #9/50.
    card: {
      front: "assets/species-cards/grey-butcherbird-front.jpg",
      back: "assets/species-cards/grey-butcherbird-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Grey Butcherbird">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/grey-butcherbird-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "masked lapwing": {
    // George's own fully-designed trading card (front + back), species #10/50.
    card: {
      front: "assets/species-cards/masked-lapwing-front.jpg",
      back: "assets/species-cards/masked-lapwing-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Masked Lapwing">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/masked-lapwing-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "pied butcherbird": {
    // George's own fully-designed trading card (front + back), species #11/50.
    card: {
      front: "assets/species-cards/pied-butcherbird-front.jpg",
      back: "assets/species-cards/pied-butcherbird-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Pied Butcherbird">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/pied-butcherbird-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "australasian figbird": {
    // George's own fully-designed trading card (front + back), species #13/50.
    card: {
      front: "assets/species-cards/australasian-figbird-front.jpg",
      back: "assets/species-cards/australasian-figbird-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Australasian Figbird">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/australasian-figbird-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "brown honeyeater": {
    // George's own fully-designed trading card (front + back), species #14/50.
    card: {
      front: "assets/species-cards/brown-honeyeater-front.jpg",
      back: "assets/species-cards/brown-honeyeater-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Brown Honeyeater">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/brown-honeyeater-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "pied currawong": {
    // George's own fully-designed trading card (front + back), species #15/50.
    card: {
      front: "assets/species-cards/pied-currawong-front.jpg",
      back: "assets/species-cards/pied-currawong-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Pied Currawong">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/pied-currawong-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "crested pigeon": {
    // George's own fully-designed trading card (front + back), species #17/50.
    card: {
      front: "assets/species-cards/crested-pigeon-front.jpg",
      back: "assets/species-cards/crested-pigeon-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Crested Pigeon">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/crested-pigeon-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "striated pardalote": {
    // George's own fully-designed trading card (front + back), species #18/50.
    card: {
      front: "assets/species-cards/striated-pardalote-front.jpg",
      back: "assets/species-cards/striated-pardalote-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Striated Pardalote">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/striated-pardalote-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "blue-faced honeyeater": {
    // George's own fully-designed trading card (front + back), species #19/50.
    card: {
      front: "assets/species-cards/blue-faced-honeyeater-front.jpg",
      back: "assets/species-cards/blue-faced-honeyeater-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Blue-faced Honeyeater">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/blue-faced-honeyeater-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "australian brushturkey": {
    // George's own fully-designed trading card (front + back), species #20/50.
    card: {
      front: "assets/species-cards/australian-brushturkey-front.jpg",
      back: "assets/species-cards/australian-brushturkey-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Australian Brushturkey">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/australian-brushturkey-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "pacific black duck": {
    // George's own fully-designed trading card (front + back), species #22/50.
    card: {
      front: "assets/species-cards/pacific-black-duck-front.jpg",
      back: "assets/species-cards/pacific-black-duck-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Pacific Black Duck">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/pacific-black-duck-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "australian wood duck": {
    // George's own fully-designed trading card (front + back), species #23/50.
    card: {
      front: "assets/species-cards/australian-wood-duck-front.jpg",
      back: "assets/species-cards/australian-wood-duck-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Australian Wood Duck">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/australian-wood-duck-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "silvereye": {
    // George's own fully-designed trading card (front + back), species #25/50.
    card: {
      front: "assets/species-cards/silvereye-front.jpg",
      back: "assets/species-cards/silvereye-back.jpg"
    },
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Silvereye">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/silvereye-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "noisy friarbird": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Noisy Friarbird">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/noisy-friarbird-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "rainbow bee-eater": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Rainbow Bee-eater">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/rainbow-bee-eater-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "sacred kingfisher": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Sacred Kingfisher">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/sacred-kingfisher-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "white-faced heron": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="White-faced Heron">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/white-faced-heron-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "eastern yellow robin": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Eastern Yellow Robin">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/eastern-yellow-robin-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "red-browed finch": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Red-browed Finch">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/red-browed-finch-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "little corella": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Little Corella">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/little-corella-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "little egret": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Little Egret">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/little-egret-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "pheasant coucal": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Pheasant Coucal">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/pheasant-coucal-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "brahminy kite": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Brahminy Kite">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/brahminy-kite-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "white-bellied sea-eagle": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="White-bellied Sea-Eagle">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/white-bellied-sea-eagle-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "black-shouldered kite": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Black-shouldered Kite">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/black-shouldered-kite-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "eastern osprey": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Eastern Osprey">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/eastern-osprey-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "tawny frogmouth": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Tawny Frogmouth">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/tawny-frogmouth-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "dollarbird": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Dollarbird">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/dollarbird-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "far eastern curlew": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Far Eastern Curlew">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/far-eastern-curlew-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "caspian tern": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Caspian Tern">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/caspian-tern-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "rufous fantail": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Rufous Fantail">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/rufous-fantail-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "crimson rosella": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Crimson Rosella">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/crimson-rosella-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "southern boobook": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Southern Boobook">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/southern-boobook-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "powerful owl": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Powerful Owl">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/powerful-owl-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "white-throated needletail": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="White-throated Needletail">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/white-throated-needletail-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "noisy pitta": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Noisy Pitta">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/noisy-pitta-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "beach stone-curlew": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Beach Stone-curlew">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/beach-stone-curlew-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  },
  "wedge-tailed eagle": {
    svg:
      '<svg viewBox="0 0 100 100" role="img" aria-label="Wedge-tailed Eagle">' +
      '<g class="dex-bird">' +
      '<image href="assets/species-photos/wedge-tailed-eagle-badge.png" x="12" y="12" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>' +
      "</g></svg>"
  }
};
