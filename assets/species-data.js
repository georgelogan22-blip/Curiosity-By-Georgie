// Curiously Georgie — Brisbane Air 50 official species reference (v1.0)
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

// Ordered by tier (Abundant → Legendary), matching the Master Reference.
var SPECIES_LIST = [
  { name: "Torresian Crow", sci: "Corvus orru", tier: "A" },
  { name: "Noisy Miner", sci: "Manorina melanocephala", tier: "A" },
  { name: "Rainbow Lorikeet", sci: "Trichoglossus moluccanus", tier: "A" },
  { name: "Australian Magpie", sci: "Gymnorhina tibicen", tier: "A" },
  { name: "Welcome Swallow", sci: "Hirundo neoxena", tier: "A" },
  { name: "Australian White Ibis", sci: "Threskiornis molucca", tier: "A" },
  { name: "Magpie-lark", sci: "Grallina cyanoleuca", tier: "A" },
  { name: "Willie Wagtail", sci: "Rhipidura leucophrys", tier: "A" },
  { name: "Grey Butcherbird", sci: "Cracticus torquatus", tier: "A" },
  { name: "Masked Lapwing", sci: "Vanellus miles", tier: "A" },
  { name: "Pied Butcherbird", sci: "Cracticus nigrogularis", tier: "A" },
  { name: "Laughing Kookaburra", sci: "Dacelo novaeguineae", tier: "A" },
  { name: "Australasian Figbird", sci: "Sphecotheres vieilloti", tier: "A" },
  { name: "Brown Honeyeater", sci: "Lichmera indistincta", tier: "A" },
  { name: "Pied Currawong", sci: "Strepera graculina", tier: "A" },

  { name: "Sulphur-crested Cockatoo", sci: "Cacatua galerita", tier: "C" },
  { name: "Crested Pigeon", sci: "Ocyphaps lophotes", tier: "C" },
  { name: "Striated Pardalote", sci: "Pardalotus striatus", tier: "C" },
  { name: "Blue-faced Honeyeater", sci: "Entomyzon cyanotis", tier: "C" },
  { name: "Australian Brushturkey", sci: "Alectura lathami", tier: "C" },
  { name: "Galah", sci: "Eolophus roseicapilla", tier: "C" },
  { name: "Pacific Black Duck", sci: "Anas superciliosa", tier: "C" },
  { name: "Australian Wood Duck", sci: "Chenonetta jubata", tier: "C" },
  { name: "Australian Pelican", sci: "Pelecanus conspicillatus", tier: "C" },
  { name: "Silvereye", sci: "Zosterops lateralis", tier: "C" },

  { name: "Noisy Friarbird", sci: "Philemon corniculatus", tier: "U" },
  { name: "Rainbow Bee-eater", sci: "Merops ornatus", tier: "U" },
  { name: "Sacred Kingfisher", sci: "Todiramphus sanctus", tier: "U" },
  { name: "White-faced Heron", sci: "Egretta novaehollandiae", tier: "U" },
  { name: "Eastern Yellow Robin", sci: "Eopsaltria australis", tier: "U" },
  { name: "Red-browed Finch", sci: "Neochmia temporalis", tier: "U" },
  { name: "Little Corella", sci: "Cacatua sanguinea", tier: "U" },

  { name: "Little Egret", sci: "Egretta garzetta", tier: "R" },
  { name: "Pheasant Coucal", sci: "Centropus phasianinus", tier: "R" },
  { name: "Brahminy Kite", sci: "Haliastur indus", tier: "R" },
  { name: "White-bellied Sea-Eagle", sci: "Icthyophaga leucogaster", tier: "R" },
  { name: "Black-shouldered Kite", sci: "Elanus axillaris", tier: "R" },
  { name: "Eastern Osprey", sci: "Pandion cristatus", tier: "R" },

  { name: "Tawny Frogmouth", sci: "Podargus strigoides", tier: "S" },
  { name: "Dollarbird", sci: "Eurystomus orientalis", tier: "S" },
  { name: "Far Eastern Curlew", sci: "Numenius madagascariensis", tier: "S" },
  { name: "Caspian Tern", sci: "Hydroprogne caspia", tier: "S" },
  { name: "Rufous Fantail", sci: "Rhipidura rufifrons", tier: "S" },
  { name: "Crimson Rosella", sci: "Platycercus elegans", tier: "S" },

  { name: "Southern Boobook", sci: "Ninox boobook", tier: "SS" },
  { name: "Powerful Owl", sci: "Ninox strenua", tier: "SS" },
  { name: "White-throated Needletail", sci: "Hirundapus caudacutus", tier: "SS" },
  { name: "Noisy Pitta", sci: "Pitta versicolor", tier: "SS" },
  { name: "Beach Stone-curlew", sci: "Esacus magnirostris", tier: "SS" },

  { name: "Wedge-tailed Eagle", sci: "Aquila audax", tier: "SS+" },
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
