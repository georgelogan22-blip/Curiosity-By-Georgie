// Curiously Georgie — My Sightings dashboard: chosen "character" avatars.
//
// Single source of truth for the 8 bird avatars a participant can pick
// on their dashboard (assets/my-sightings.js renders the picker and the
// profile header from this list; supabase/avatar-migration.sql's check
// constraint and update_participant_avatar() enforce the same 8 keys
// server-side — if this list ever changes, update both together).
//
// Each avatar is a simple perched-bird illustration, not a photo-real
// one — colour and silhouette carry the identification (the same
// "flat, legible at small sizes" approach as the discipline badges),
// picked from familiar Brisbane back-yard and waterway birds so most
// participants will recognise one they've actually seen.
var AVATARS = [
  {
    key: "lorikeet",
    label: "Rainbow Lorikeet",
    bg: "#e7f3ea",
    svg:
      '<circle cx="50" cy="52" r="22" fill="#1f7a4d"/>' +
      '<circle cx="40" cy="42" r="12" fill="#1f5fa8"/>' +
      '<path d="M50,58 Q66,54 78,60 Q66,64 54,64 Z" fill="#e8ac5e"/>' +
      '<path d="M30,40 L18,36 L30,46 Z" fill="#e8ac5e"/>' +
      '<circle cx="34" cy="38" r="2.4" fill="#172621"/>' +
      '<path d="M50,70 Q58,82 50,90 Q42,82 50,70 Z" fill="#b7383a"/>',
  },
  {
    key: "kookaburra",
    label: "Laughing Kookaburra",
    bg: "#efe9df",
    svg:
      '<ellipse cx="52" cy="58" rx="24" ry="20" fill="#8a6a4a"/>' +
      '<circle cx="36" cy="42" r="15" fill="#c9b18f"/>' +
      '<path d="M22,40 L4,37 L22,48 Z" fill="#45342180"/>' +
      '<path d="M22,40 L4,37 L22,45 Z" fill="#453421"/>' +
      '<circle cx="32" cy="38" r="2.6" fill="#172621"/>' +
      '<path d="M22,30 Q34,22 46,28" fill="none" stroke="#5c4630" stroke-width="4" stroke-linecap="round"/>',
  },
  {
    key: "magpie",
    label: "Australian Magpie",
    bg: "#eceae4",
    svg:
      '<ellipse cx="52" cy="58" rx="24" ry="20" fill="#1c1c1c"/>' +
      '<path d="M30,50 Q52,46 60,58 Q46,64 30,58 Z" fill="#f4f4f0"/>' +
      '<circle cx="36" cy="40" r="13" fill="#1c1c1c"/>' +
      '<path d="M23,38 L8,35 L23,45 Z" fill="#e0e0d8"/>' +
      '<circle cx="33" cy="37" r="2.4" fill="#f4f4f0"/>' +
      '<path d="M60,78 Q70,86 62,92 Q54,86 60,78 Z" fill="#1c1c1c"/>',
  },
  {
    key: "cockatoo",
    label: "Sulphur-crested Cockatoo",
    bg: "#f6f3e6",
    svg:
      '<ellipse cx="52" cy="60" rx="22" ry="19" fill="#fbfaf3"/>' +
      '<circle cx="38" cy="44" r="13" fill="#fbfaf3"/>' +
      '<path d="M32,32 L26,12 L38,30 Z" fill="#e8c34a"/>' +
      '<path d="M40,30 L40,10 L48,28 Z" fill="#e8c34a"/>' +
      '<path d="M48,32 L54,14 L56,32 Z" fill="#e8c34a"/>' +
      '<path d="M25,42 L10,39 L25,49 Z" fill="#45342b"/>' +
      '<circle cx="35" cy="40" r="2.4" fill="#172621"/>',
  },
  {
    key: "galah",
    label: "Galah",
    bg: "#f6ecec",
    svg:
      '<ellipse cx="52" cy="60" rx="23" ry="19" fill="#d98fa3"/>' +
      '<circle cx="38" cy="44" r="13" fill="#d98fa3"/>' +
      '<path d="M32,34 Q38,20 48,26 Q40,30 36,40 Z" fill="#c9c9c9"/>' +
      '<path d="M60,50 Q76,52 80,64 Q68,68 58,62 Z" fill="#c9c9c9"/>' +
      '<path d="M25,42 L10,39 L25,49 Z" fill="#8a8a8a"/>' +
      '<circle cx="35" cy="40" r="2.4" fill="#172621"/>',
  },
  {
    key: "wagtail",
    label: "Willie Wagtail",
    bg: "#eceae4",
    svg:
      '<ellipse cx="48" cy="58" rx="18" ry="15" fill="#1c1c1c"/>' +
      '<circle cx="36" cy="46" r="11" fill="#1c1c1c"/>' +
      '<path d="M60,60 Q84,52 90,68 Q84,80 62,72 Q72,64 60,60 Z" fill="#1c1c1c"/>' +
      '<path d="M25,45 L12,42 L25,50 Z" fill="#3a3a3a"/>' +
      '<circle cx="33" cy="43" r="2.2" fill="#f4f4f0"/>' +
      '<path d="M28,56 Q36,66 46,60" fill="none" stroke="#f4f4f0" stroke-width="4" stroke-linecap="round"/>',
  },
  {
    key: "pelican",
    label: "Australian Pelican",
    bg: "#e9eef4",
    svg:
      '<ellipse cx="54" cy="62" rx="24" ry="18" fill="#fbfaf3"/>' +
      '<circle cx="36" cy="46" r="12" fill="#fbfaf3"/>' +
      '<path d="M25,44 L2,40 Q10,50 2,56 L25,52 Z" fill="#e8ac5e"/>' +
      '<path d="M25,44 L2,40 Q10,44 2,48 L25,48 Z" fill="#d98a3a"/>' +
      '<circle cx="33" cy="41" r="2.2" fill="#172621"/>' +
      '<path d="M56,46 Q70,40 74,52 Q64,56 56,50 Z" fill="#1f5fa8"/>',
  },
  {
    key: "eagle",
    label: "Wedge-tailed Eagle",
    bg: "#efe9e2",
    svg:
      '<ellipse cx="52" cy="58" rx="24" ry="20" fill="#4a3826"/>' +
      '<circle cx="38" cy="42" r="13" fill="#5c4630"/>' +
      '<path d="M50,52 Q76,44 92,54 Q76,62 54,60 Z" fill="#3a2c1c"/>' +
      '<path d="M25,40 L8,37 L25,47 Z" fill="#e8ac5e"/>' +
      '<circle cx="35" cy="38" r="2.6" fill="#172621"/>' +
      '<path d="M46,78 Q54,90 44,94 Q38,84 46,78 Z" fill="#e8ac5e"/>',
  },
];

var AVATARS_BY_KEY = {};
AVATARS.forEach(function (a) {
  AVATARS_BY_KEY[a.key] = a;
});

// Returns a self-contained <svg> (a circular badge with the bird
// illustration inside) for the given avatar key, or a plain "not chosen
// yet" placeholder if key is null/unrecognised. size is the rendered
// pixel width/height.
function avatarSvg(key, size) {
  var a = key && AVATARS_BY_KEY[key];
  size = size || 56;
  if (!a) {
    return (
      '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" role="img" aria-label="No character chosen yet">' +
      '<circle cx="50" cy="50" r="48" fill="var(--paper-raised)" stroke="var(--line)" stroke-width="2" stroke-dasharray="6 5"/>' +
      '<circle cx="50" cy="42" r="14" fill="none" stroke="var(--ink-soft)" stroke-width="3"/>' +
      '<path d="M28,80 Q50,62 72,80" fill="none" stroke="var(--ink-soft)" stroke-width="3" stroke-linecap="round"/>' +
      "</svg>"
    );
  }
  return (
    '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" role="img" aria-label="' + a.label + '">' +
    '<circle cx="50" cy="50" r="48" fill="' + a.bg + '" stroke="var(--accent-warm)" stroke-width="3"/>' +
    a.svg +
    "</svg>"
  );
}
