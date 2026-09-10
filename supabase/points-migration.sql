-- Curiously Georgie — Brisbane Air 50: Air Points migration (v1.0)
--
-- Adds the official 50-species tier/points reference (from the
-- "Brisbane Air 50 — Master Reference v1.0" document) and updates the
-- leaderboard view so ranking reflects accumulated Air Points, not just
-- raw species count.
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. Safe to re-run — the table is
-- created if missing and reseeded via upsert; the view is replaced.
-- Run this AFTER the original schema.sql (it assumes public.sightings
-- already exists).

-- ---------------------------------------------------------------------
-- Table: species_reference
-- One row per official Brisbane Air 50 species, with its capture-
-- difficulty tier and Air Points value. Species a participant logs that
-- aren't on this list still count toward their tally (see rules.html) —
-- they just default to the lowest tier's points (1) in the leaderboard,
-- handled by the coalesce() in the view below rather than a row here.
-- ---------------------------------------------------------------------
create table if not exists public.species_reference (
  species_key text primary key,
  common_name text not null,
  scientific_name text,
  tier text not null check (tier in ('A', 'C', 'U', 'R', 'S', 'SS', 'SS+')),
  points integer not null,
  sort_order integer not null
);

alter table public.species_reference enable row level security;

drop policy if exists "public can read species_reference" on public.species_reference;
create policy "public can read species_reference"
  on public.species_reference for select
  to anon
  using (true);

-- Seed / reseed the official 50. On conflict, update in place so a
-- future re-run (e.g. v1.1 of the reference doc) can safely update
-- tiers/points without duplicating rows.
insert into public.species_reference (species_key, common_name, scientific_name, tier, points, sort_order) values
  ('torresian crow', 'Torresian Crow', 'Corvus orru', 'A', 1, 1),
  ('noisy miner', 'Noisy Miner', 'Manorina melanocephala', 'A', 1, 2),
  ('rainbow lorikeet', 'Rainbow Lorikeet', 'Trichoglossus moluccanus', 'A', 1, 3),
  ('australian magpie', 'Australian Magpie', 'Gymnorhina tibicen', 'A', 1, 4),
  ('welcome swallow', 'Welcome Swallow', 'Hirundo neoxena', 'A', 1, 5),
  ('australian white ibis', 'Australian White Ibis', 'Threskiornis molucca', 'A', 1, 6),
  ('magpie-lark', 'Magpie-lark', 'Grallina cyanoleuca', 'A', 1, 7),
  ('willie wagtail', 'Willie Wagtail', 'Rhipidura leucophrys', 'A', 1, 8),
  ('grey butcherbird', 'Grey Butcherbird', 'Cracticus torquatus', 'A', 1, 9),
  ('masked lapwing', 'Masked Lapwing', 'Vanellus miles', 'A', 1, 10),
  ('pied butcherbird', 'Pied Butcherbird', 'Cracticus nigrogularis', 'A', 1, 11),
  ('laughing kookaburra', 'Laughing Kookaburra', 'Dacelo novaeguineae', 'A', 1, 12),
  ('australasian figbird', 'Australasian Figbird', 'Sphecotheres vieilloti', 'A', 1, 13),
  ('brown honeyeater', 'Brown Honeyeater', 'Lichmera indistincta', 'A', 1, 14),
  ('pied currawong', 'Pied Currawong', 'Strepera graculina', 'A', 1, 15),

  ('sulphur-crested cockatoo', 'Sulphur-crested Cockatoo', 'Cacatua galerita', 'C', 2, 16),
  ('crested pigeon', 'Crested Pigeon', 'Ocyphaps lophotes', 'C', 2, 17),
  ('striated pardalote', 'Striated Pardalote', 'Pardalotus striatus', 'C', 2, 18),
  ('blue-faced honeyeater', 'Blue-faced Honeyeater', 'Entomyzon cyanotis', 'C', 2, 19),
  ('australian brushturkey', 'Australian Brushturkey', 'Alectura lathami', 'C', 2, 20),
  ('galah', 'Galah', 'Eolophus roseicapilla', 'C', 2, 21),
  ('pacific black duck', 'Pacific Black Duck', 'Anas superciliosa', 'C', 2, 22),
  ('australian wood duck', 'Australian Wood Duck', 'Chenonetta jubata', 'C', 2, 23),
  ('australian pelican', 'Australian Pelican', 'Pelecanus conspicillatus', 'C', 2, 24),
  ('silvereye', 'Silvereye', 'Zosterops lateralis', 'C', 2, 25),

  ('noisy friarbird', 'Noisy Friarbird', 'Philemon corniculatus', 'U', 3, 26),
  ('rainbow bee-eater', 'Rainbow Bee-eater', 'Merops ornatus', 'U', 3, 27),
  ('sacred kingfisher', 'Sacred Kingfisher', 'Todiramphus sanctus', 'U', 3, 28),
  ('white-faced heron', 'White-faced Heron', 'Egretta novaehollandiae', 'U', 3, 29),
  ('eastern yellow robin', 'Eastern Yellow Robin', 'Eopsaltria australis', 'U', 3, 30),
  ('red-browed finch', 'Red-browed Finch', 'Neochmia temporalis', 'U', 3, 31),
  ('little corella', 'Little Corella', 'Cacatua sanguinea', 'U', 3, 32),

  ('little egret', 'Little Egret', 'Egretta garzetta', 'R', 5, 33),
  ('pheasant coucal', 'Pheasant Coucal', 'Centropus phasianinus', 'R', 5, 34),
  ('brahminy kite', 'Brahminy Kite', 'Haliastur indus', 'R', 5, 35),
  ('white-bellied sea-eagle', 'White-bellied Sea-Eagle', 'Icthyophaga leucogaster', 'R', 5, 36),
  ('black-shouldered kite', 'Black-shouldered Kite', 'Elanus axillaris', 'R', 5, 37),
  ('eastern osprey', 'Eastern Osprey', 'Pandion cristatus', 'R', 5, 38),

  ('tawny frogmouth', 'Tawny Frogmouth', 'Podargus strigoides', 'S', 8, 39),
  ('dollarbird', 'Dollarbird', 'Eurystomus orientalis', 'S', 8, 40),
  ('far eastern curlew', 'Far Eastern Curlew', 'Numenius madagascariensis', 'S', 8, 41),
  ('caspian tern', 'Caspian Tern', 'Hydroprogne caspia', 'S', 8, 42),
  ('rufous fantail', 'Rufous Fantail', 'Rhipidura rufifrons', 'S', 8, 43),
  ('crimson rosella', 'Crimson Rosella', 'Platycercus elegans', 'S', 8, 44),

  ('southern boobook', 'Southern Boobook', 'Ninox boobook', 'SS', 13, 45),
  ('powerful owl', 'Powerful Owl', 'Ninox strenua', 'SS', 13, 46),
  ('white-throated needletail', 'White-throated Needletail', 'Hirundapus caudacutus', 'SS', 13, 47),
  ('noisy pitta', 'Noisy Pitta', 'Pitta versicolor', 'SS', 13, 48),
  ('beach stone-curlew', 'Beach Stone-curlew', 'Esacus magnirostris', 'SS', 13, 49),

  ('wedge-tailed eagle', 'Wedge-tailed Eagle', 'Aquila audax', 'SS+', 20, 50)
on conflict (species_key) do update set
  common_name = excluded.common_name,
  scientific_name = excluded.scientific_name,
  tier = excluded.tier,
  points = excluded.points,
  sort_order = excluded.sort_order;

grant select on public.species_reference to anon;

-- ---------------------------------------------------------------------
-- View: leaderboard (replaces the original from schema.sql)
-- Adds total_points: for each participant, the sum of Air Points across
-- their distinct confirmed species (first sighting of a species is what
-- counts, same rule as species_count). A species not in
-- species_reference (typed freeform, not one of the official 50) is
-- worth the minimum tier value (1 point) rather than nothing, via
-- coalesce() — it still shows up and still counts, just at the lowest
-- weight since it has no assigned difficulty tier.
-- ---------------------------------------------------------------------
create or replace view public.leaderboard as
with species_first_seen as (
  -- One row per participant per distinct confirmed species — this is
  -- what "counts" (repeat sightings of the same species are logged but
  -- collapse to a single row here, so they can't inflate points).
  select
    participant_key,
    species_key,
    min(created_at) as first_logged_at
  from public.sightings
  where status = 'confirmed'
  group by participant_key, species_key
),
participant_activity as (
  -- Display name (most recently-used spelling) and most recent sighting
  -- date, over ALL of a participant's confirmed sightings (repeats
  -- included) — this is just "how active/recent", not a tally.
  select
    participant_key,
    (array_agg(participant_name order by created_at desc))[1] as participant_name,
    max(sighting_date) as last_sighting
  from public.sightings
  where status = 'confirmed'
  group by participant_key
)
select
  sfs.participant_key,
  pa.participant_name,
  count(distinct sfs.species_key) as species_count,
  coalesce(sum(coalesce(sr.points, 1)), 0) as total_points,
  pa.last_sighting
from species_first_seen sfs
join participant_activity pa on pa.participant_key = sfs.participant_key
left join public.species_reference sr on sr.species_key = sfs.species_key
group by sfs.participant_key, pa.participant_name, pa.last_sighting
having count(distinct sfs.species_key) > 0
order by total_points desc, species_count desc, pa.last_sighting desc;

grant select on public.leaderboard to anon;

-- Hall of Fame stays exactly as before (species_count >= 50, worked out
-- client-side in assets/supabase-client.js) — George confirmed induction
-- should stay tied to completing all 50 species, independent of points.
