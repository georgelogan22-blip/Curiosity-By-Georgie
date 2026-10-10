// Curiosity by Georgie — Brisbane Air 50 official species reference (v1.0)
//
// Mirrors supabase/points-migration.sql's species_reference table, so the
// species autocomplete (log-sighting.html) and the Species Checklist page
// can show each species' tier + Air Points instantly, without a network
// round trip. The database copy is what actually decides Leaderboard
// points — this file is a display-only mirror. If the reference doc is
// ever revised, update both this file and the migration together.
//
// Tier order matches the "Capture Difficulty Tier System": Abundant is
// easiest, Legendary is the single hardest species in the challenge.

var SPECIES_TIERS = {
  A: {
    label: "Abundant",
    points: 1,
    className: "tier-a",
    desc: "Very easy to encounter across suitable Brisbane habitats; often found without specialist searching.",
  },
  C: {
    label: "Common",
    points: 2,
    className: "tier-c",
    desc: "Generally straightforward to find with modest habitat awareness or a short targeted outing.",
  },
  U: {
    label: "Uncommon",
    points: 3,
    className: "tier-u",
    desc: "Requires some deliberate searching, habitat choice or seasonal awareness.",
  },
  R: {
    label: "Rare",
    points: 5,
    className: "tier-r",
    desc: "Usually needs targeted habitat, location knowledge or repeated effort.",
  },
  S: {
    label: "Special",
    points: 8,
    className: "tier-s",
    desc: "Difficult, localised, seasonal, cryptic or otherwise demanding to photograph.",
  },
  SS: {
    label: "Super Special",
    points: 13,
    className: "tier-ss",
    desc: "Exceptionally challenging — strong habitat knowledge, timing, luck or repeated effort may be required.",
  },
  "SS+": {
    label: "Legendary",
    points: 20,
    className: "tier-ssplus",
    desc: "The symbolic final objective of Air 50: a genuinely difficult and highly memorable Brisbane capture.",
  },
};

// Fixed display order, easiest to hardest.
var TIER_ORDER = ["A", "C", "U", "R", "S", "SS", "SS+"];

// `wiki` holds each species' Wikipedia article slug (the part of the URL
// after /wiki/) — used by the Species Checklist page to link each common
// name to a photo + brief description on a reputable, freely-licensed
// source. Checked by hand against en.wikipedia.org on 2026-10-10; a few
// don't match the common name used here 1:1 because Wikipedia's article
// title follows current taxonomy (e.g. our "Dollarbird" is Wikipedia's
// "Oriental dollarbird"; our "Southern Boobook" is now merged into
// Wikipedia's "Australian boobook"; our "Rufous Fantail" is Wikipedia's
// "Australian rufous fantail", split out from the wider Rufous Fantail
// complex) — all verified to be the correct species page regardless of
// title wording.
var SPECIES_LIST = [
  { name: "Torresian Crow", sci: "Corvus orru", tier: "A", wiki: "Torresian_crow" },
  { name: "Noisy Miner", sci: "Manorina melanocephala", tier: "A", wiki: "Noisy_miner" },
  { name: "Rainbow Lorikeet", sci: "Trichoglossus moluccanus", tier: "A", wiki: "Rainbow_lorikeet" },
  { name: "Australian Magpie", sci: "Gymnorhina tibicen", tier: "A", wiki: "Australian_magpie" },
  { name: "Welcome Swallow", sci: "Hirundo neoxena", tier: "A", wiki: "Welcome_swallow" },
  { name: "Australian White Ibis", sci: "Threskiornis molucca", tier: "A", wiki: "Australian_white_ibis" },
  { name: "Magpie-lark", sci: "Grallina cyanoleuca", tier: "A", wiki: "Magpie-lark" },
  { name: "Willie Wagtail", sci: "Rhipidura leucophrys", tier: "A", wiki: "Willie_wagtail" },
  { name: "Grey Butcherbird", sci: "Cracticus torquatus", tier: "A", wiki: "Grey_butcherbird" },
  { name: "Masked Lapwing", sci: "Vanellus miles", tier: "A", wiki: "Masked_lapwing" },
  { name: "Pied Butcherbird", sci: "Cracticus nigrogularis", tier: "A", wiki: "Pied_butcherbird" },
  { name: "Laughing Kookaburra", sci: "Dacelo novaeguineae", tier: "A", wiki: "Laughing_kookaburra" },
  { name: "Australasian Figbird", sci: "Sphecotheres vieilloti", tier: "A", wiki: "Australasian_figbird" },
  { name: "Brown Honeyeater", sci: "Lichmera indistincta", tier: "A", wiki: "Brown_honeyeater" },
  { name: "Pied Currawong", sci: "Strepera graculina", tier: "A", wiki: "Pied_currawong" },

  { name: "Sulphur-crested Cockatoo", sci: "Cacatua galerita", tier: "C", wiki: "Sulphur-crested_cockatoo" },
  { name: "Crested Pigeon", sci: "Ocyphaps lophotes", tier: "C", wiki: "Crested_pigeon" },
  { name: "Striated Pardalote", sci: "Pardalotus striatus", tier: "C", wiki: "Striated_pardalote" },
  { name: "Blue-faced Honeyeater", sci: "Entomyzon cyanotis", tier: "C", wiki: "Blue-faced_honeyeater" },
  { name: "Australian Brushturkey", sci: "Alectura lathami", tier: "C", wiki: "Australian_brushturkey" },
  { name: "Galah", sci: "Eolophus roseicapilla", tier: "C", wiki: "Galah" },
  { name: "Pacific Black Duck", sci: "Anas superciliosa", tier: "C", wiki: "Pacific_black_duck" },
  { name: "Australian Wood Duck", sci: "Chenonetta jubata", tier: "C", wiki: "Australian_wood_duck" },
  { name: "Australian Pelican", sci: "Pelecanus conspicillatus", tier: "C", wiki: "Australian_pelican" },
  { name: "Silvereye", sci: "Zosterops lateralis", tier: "C", wiki: "Silvereye" },

  { name: "Noisy Friarbird", sci: "Philemon corniculatus", tier: "U", wiki: "Noisy_friarbird" },
  { name: "Rainbow Bee-eater", sci: "Merops ornatus", tier: "U", wiki: "Rainbow_bee-eater" },
  { name: "Sacred Kingfisher", sci: "Todiramphus sanctus", tier: "U", wiki: "Sacred_kingfisher" },
  { name: "White-faced Heron", sci: "Egretta novaehollandiae", tier: "U", wiki: "White-faced_heron" },
  { name: "Eastern Yellow Robin", sci: "Eopsaltria australis", tier: "U", wiki: "Eastern_yellow_robin" },
  { name: "Red-browed Finch", sci: "Neochmia temporalis", tier: "U", wiki: "Red-browed_finch" },
  { name: "Little Corella", sci: "Cacatua sanguinea", tier: "U", wiki: "Little_corella" },

  { name: "Little Egret", sci: "Egretta garzetta", tier: "R", wiki: "Little_egret" },
  { name: "Pheasant Coucal", sci: "Centropus phasianinus", tier: "R", wiki: "Pheasant_coucal" },
  { name: "Brahminy Kite", sci: "Haliastur indus", tier: "R", wiki: "Brahminy_kite" },
  { name: "White-bellied Sea-Eagle", sci: "Icthyophaga leucogaster", tier: "R", wiki: "White-bellied_sea_eagle" },
  { name: "Black-shouldered Kite", sci: "Elanus axillaris", tier: "R", wiki: "Black-shouldered_kite" },
  { name: "Eastern Osprey", sci: "Pandion cristatus", tier: "R", wiki: "Eastern_osprey" },

  { name: "Tawny Frogmouth", sci: "Podargus strigoides", tier: "S", wiki: "Tawny_frogmouth" },
  { name: "Dollarbird", sci: "Eurystomus orientalis", tier: "S", wiki: "Oriental_dollarbird" },
  { name: "Far Eastern Curlew", sci: "Numenius madagascariensis", tier: "S", wiki: "Far_Eastern_curlew" },
  { name: "Caspian Tern", sci: "Hydroprogne caspia", tier: "S", wiki: "Caspian_tern" },
  { name: "Rufous Fantail", sci: "Rhipidura rufifrons", tier: "S", wiki: "Australian_rufous_fantail" },
  { name: "Crimson Rosella", sci: "Platycercus elegans", tier: "S", wiki: "Crimson_rosella" },

  { name: "Southern Boobook", sci: "Ninox boobook", tier: "SS", wiki: "Australian_boobook" },
  { name: "Powerful Owl", sci: "Ninox strenua", tier: "SS", wiki: "Powerful_owl" },
  { name: "White-throated Needletail", sci: "Hirundapus caudacutus", tier: "SS", wiki: "White-throated_needletail" },
  { name: "Noisy Pitta", sci: "Pitta versicolor", tier: "SS", wiki: "Noisy_pitta" },
  { name: "Beach Stone-curlew", sci: "Esacus magnirostris", tier: "SS", wiki: "Beach_stone-curlew" },

  { name: "Wedge-tailed Eagle", sci: "Aquila audax", tier: "SS+", wiki: "Wedge-tailed_eagle" },
];

// Species-key lookup (lowercased/trimmed name -> full entry incl. points),
// mirroring the DB's `lower(trim(species))` normalisation so the two stay
// in agreement about which typed text matches an official species.
var SPECIES_BY_KEY = {};
SPECIES_LIST.forEach(function (sp) {
  var tierInfo = SPECIES_TIERS[sp.tier];
  SPECIES_BY_KEY[sp.name.toLowerCase().trim()] = {
    name: sp.name,
    sci: sp.sci,
    tier: sp.tier,
    tierLabel: tierInfo.label,
    points: tierInfo.points,
  };
});

// Look up a typed species name (any casing/whitespace) against the
// official list. Returns null for anything not on the list — those
// sightings still count (see rules.html) but aren't tier-rated.
function lookupSpecies(typedName) {
  if (!typedName) return null;
  return SPECIES_BY_KEY[String(typedName).toLowerCase().trim()] || null;
}
