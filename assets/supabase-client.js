// Curiously Georgie — Supabase client + data helpers
//
// Fill in your project's URL and anon (public) key below, from
// Supabase → Project Settings → API. The anon key is *meant* to be
// public / embedded in client-side code like this — Supabase's Row
// Level Security policies (see supabase/schema.sql) are what actually
// control what it's allowed to do, not secrecy of this key.
var SUPABASE_URL = "https://nduhuiihmagptvrxgkhk.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_4suKIlKFIFlo8WWO4_ZgyA_0GTq8mXf";

var supabaseClient = null;
if (
  typeof window !== "undefined" &&
  window.supabase &&
  SUPABASE_URL.indexOf("http") === 0
) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Hashes a PIN with SHA-256 and returns the hex digest — the same
// digest format supabase/registration-migration.sql's pin_hash column
// expects. The raw PIN is never sent to or stored by Supabase, only
// this digest. Shared by assets/register.js (hashes the PIN chosen at
// registration) and assets/script.js (hashes the PIN re-entered at
// sighting-log time), so the two digests can be compared server-side
// without either end ever seeing the other's actual PIN.
function hashPin(pin) {
  var bytes = new TextEncoder().encode(String(pin).trim());
  return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
    return Array.prototype.map
      .call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  });
}

// Submit one sighting via the submit_sighting() database function (see
// supabase/registration-migration.sql + photo-verification-migration.sql)
// — this checks, in one call, that record.name is registered, active
// (not banned), and that record.pinHash matches the PIN hash stored at
// registration, before inserting. The row always starts out 'pending';
// the verify-sighting Edge Function (triggered by a Database Webhook —
// see supabase/functions/verify-sighting) auto-confirms it moments later
// if the photo's date and species both check out, otherwise it stays
// pending for Georgie to review by eye. Resolves with the saved row.
// Rejects with an error whose .message is one of "not_registered",
// "not_active", "invalid_pin", or "photo_required" (raised by the
// database function) so the form can show a specific hint for each case
// — see assets/script.js.
function submitSighting(record) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return supabaseClient
    .rpc("submit_sighting", {
      p_name: record.name,
      p_pin_hash: record.pinHash,
      p_species: record.species,
      p_sighting_date: record.date,
      p_location: record.location || null,
      p_notes: record.notes || null,
      p_photo_path: record.photoPath,
      p_photo_taken_at: record.photoTakenAt || null,
    })
    .then(function (res) {
      if (res.error) throw res.error;
      return Array.isArray(res.data) ? res.data[0] : res.data;
    });
}

// Uploads the evidence photo to the public "sighting-photos" Storage
// bucket (see photo-verification-migration.sql) ahead of the actual
// submit_sighting() call, and resolves with the storage path to pass in
// as record.photoPath. Each photo gets a random, collision-proof name —
// the original filename is never used or stored, so it can't leak
// anything about the participant's device or photo library.
function uploadSightingPhoto(file) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  var ext = (file.name && file.name.indexOf(".") !== -1)
    ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
    : "jpg";
  var id = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
  var path = id + "." + (ext || "jpg");
  return supabaseClient.storage
    .from("sighting-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false })
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data.path;
    });
}

// Reads a photo's original capture date (EXIF "DateTimeOriginal") using
// the exifr library (see the <script> tag on log-sighting.html) —
// exactly what supabase/functions/verify-sighting checks against the
// challenge's launch date, so a screenshot or a photo with its metadata
// stripped shows up as "no date" rather than silently passing. Resolves
// with a "YYYY-MM-DD" string, or null if no date could be read (missing
// EXIF, unsupported format, or the exifr library failed to load).
function readPhotoTakenDate(file) {
  if (typeof exifr === "undefined") return Promise.resolve(null);
  // Note: exifr.parse(file, ["DateTimeOriginal", "CreateDate"]) — the
  // array-shorthand "pick" form — throws in the exifr build this site
  // loads ("undefined is not iterable"), which was silently swallowed by
  // the .catch() below, so EVERY sighting was coming back "no readable
  // capture date" regardless of the photo. Calling parse() with no
  // options at all reads the full tag set reliably; we just pick the two
  // fields we need out of it ourselves.
  return exifr
    .parse(file)
    .then(function (tags) {
      var d = tags && (tags.DateTimeOriginal || tags.CreateDate);
      if (!d) return null;
      var date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().slice(0, 10);
    })
    .catch(function () {
      return null;
    });
}

// Register a new participant (see supabase/registration-migration.sql).
// Resolves once the row is saved (with no data — see note below), or
// rejects with the Supabase/Postgres error (err.code is the Postgres
// error code — e.g. "23505" for a duplicate display name, "23514" for
// the parental-consent check) so the form can show a friendly message
// for the common cases.
//
// Deliberately does NOT chain .select() here. participants only has an
// INSERT policy for the anon role, not a SELECT one (it holds full
// legal names, addresses, phone numbers and pin_hash — not something
// to expose via a public read policy), and Postgres checks a
// RETURNING/`.select()` row against SELECT policies too. Asking for
// the row back therefore fails RLS even though the insert itself is
// allowed. Nothing currently needs the returned row (register.js uses
// the record it already has locally), so the fix is simply not to ask
// for it back.
function registerParticipant(record) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return supabaseClient
    .from("participants")
    .insert({
      display_name: record.displayName,
      full_legal_name: record.fullName,
      date_of_birth: record.dob,
      address_line: record.addressLine,
      suburb: record.suburb,
      state: record.state,
      postcode: record.postcode,
      phone: record.phone,
      email: record.email,
      parental_consent: !!record.parentalConsent,
      pin_hash: record.pinHash,
    })
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
}

// Looks up whether a display name is registered, without exposing any
// of that participant's actual details — calls the participant_status()
// database function (SECURITY DEFINER, see the migration). Resolves
// with "active", "banned", or null (not registered at all). Resolves
// with null (rather than rejecting) if the backend isn't configured,
// so callers can treat "unknown" the same as "not registered".
function participantStatus(name) {
  if (!supabaseClient || !name) return Promise.resolve(null);
  return supabaseClient
    .rpc("participant_status", { key: name })
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data || null;
    });
}

// Top N participants by accumulated Air Points (see
// supabase/points-migration.sql and supabase/air50-hall-of-fame-migration.sql
// — the leaderboard view sums each participant's confirmed distinct
// species' tier points, where an off-list species is worth 0 points.
// George's decision, 2026-09-13: species logging itself stays open — no
// restriction to the official 50, since that's core to the spirit of the
// game — but the "Species" column shown on the Leaderboard uses
// air50_species_count (official-50-only), not the raw species_count (which
// includes off-list species), so the leaderboard reads as clean progress
// toward the full set of 50 rather than a number that can outrun it. Same
// field fetchHallOfFame() below gates induction on.
function fetchLeaderboard(limit) {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("leaderboard")
    .select("*")
    .order("total_points", { ascending: false })
    .order("air50_species_count", { ascending: false })
    .order("last_sighting", { ascending: false })
    .limit(limit || 25)
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
}

// Everyone George has actually PUBLISHED to the Hall of Fame — see
// supabase/hall-of-fame-inductions-migration.sql. Reaching
// air50_species_count >= 50 on the leaderboard (all 50 OFFICIAL Brisbane
// Air 50 species confirmed) only makes someone ELIGIBLE for induction; it
// no longer publishes them automatically. George's decision, 2026-09-13:
// before anyone goes up permanently, he does one final manual look back
// over that participant's 50 confirmed sightings (their evidence photos
// are already sitting in storage from when each was originally logged —
// no new submission needed) and only then adds their induction row. So
// this just reads hall_of_fame_inductions and joins in each inductee's
// current species_count/total_points from the leaderboard for display.
function fetchHallOfFame() {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("hall_of_fame_inductions")
    .select("participant_key, inducted_at")
    .order("inducted_at", { ascending: true })
    .then(function (indRes) {
      if (indRes.error) throw indRes.error;
      var inductions = indRes.data || [];
      if (!inductions.length) return [];
      return supabaseClient
        .from("leaderboard")
        .select("*")
        .then(function (lbRes) {
          if (lbRes.error) throw lbRes.error;
          var byKey = {};
          (lbRes.data || []).forEach(function (row) {
            byKey[row.participant_key] = row;
          });
          return inductions.map(function (ind) {
            var lb = byKey[ind.participant_key] || {};
            return {
              name: lb.participant_name || ind.participant_key,
              count: lb.species_count,
              points: lb.total_points,
              inductedAt: ind.inducted_at,
            };
          });
        });
    });
}

// Looks up one participant's own sightings (status, and — while
// pending — whatever the automated review already found), gated by
// name + PIN so no one can browse another participant's queue just by
// guessing their display name. Calls the participant_sightings()
// database function (see supabase/my-sightings-migration.sql).
// Resolves with an array of rows (newest first), or rejects with an
// error whose .message is "not_registered" or "invalid_pin" (raised by
// the database function) so the page can show a specific message —
// see assets/my-sightings.js.
function fetchMySightings(name, pinHash) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return supabaseClient
    .rpc("participant_sightings", { p_name: name, p_pin_hash: pinHash })
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
}

// ---------------------------------------------------------------------
// Community Board ("Chat") — see supabase/community-board-migration.sql.
// Anyone can browse the board (fetchBoardPosts/fetchBoardComments need
// no credentials); posting and commenting are gated by name + PIN, the
// same pattern as logging a sighting.
// ---------------------------------------------------------------------

// Uploads a post's photo to the public "board-photos" Storage bucket
// ahead of the actual createBoardPost() call, and resolves with the
// storage path to pass in as record.photoPath. Same random-filename
// approach as uploadSightingPhoto() — the original filename is never
// used or stored.
function uploadBoardPhoto(file) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  var ext = (file.name && file.name.indexOf(".") !== -1)
    ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
    : "jpg";
  var id = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
  var path = id + "." + (ext || "jpg");
  return supabaseClient.storage
    .from("board-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false })
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data.path;
    });
}

// Creates a new board post via create_board_post() (security definer —
// checks registration/active/PIN, same as submit_sighting()). record:
// { name, pinHash, caption, photoPath } — photoPath may be null/undefined
// for a text-only post. Resolves with the saved row. Rejects with an
// error whose .message is "not_registered" / "not_active" / "invalid_pin"
// / "caption_required".
function createBoardPost(record) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return supabaseClient
    .rpc("create_board_post", {
      p_name: record.name,
      p_pin_hash: record.pinHash,
      p_caption: record.caption,
      p_photo_path: record.photoPath || null,
    })
    .then(function (res) {
      if (res.error) throw res.error;
      return Array.isArray(res.data) ? res.data[0] : res.data;
    });
}

// Creates a new comment on a post via create_board_comment(). record:
// { postId, name, pinHash, body }. Rejects with an error whose .message
// is "not_registered" / "not_active" / "invalid_pin" / "body_required" /
// "post_not_found".
function createBoardComment(record) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return supabaseClient
    .rpc("create_board_comment", {
      p_post_id: record.postId,
      p_name: record.name,
      p_pin_hash: record.pinHash,
      p_body: record.body,
    })
    .then(function (res) {
      if (res.error) throw res.error;
      return Array.isArray(res.data) ? res.data[0] : res.data;
    });
}

// Fetches the board feed, newest first. Resolves with [] if the backend
// isn't configured (rather than rejecting), so the page can fall back to
// example posts — see assets/chat.js.
function fetchBoardPosts(limit) {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("board_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit || 100)
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
}

// Builds the public URL for a photo already uploaded to the board-photos
// bucket (photo_path as stored on a board_posts row) — mirrors how
// pending_sightings_review builds sighting photo URLs server-side, just
// done client-side here since board posts are public to begin with.
function boardPhotoUrl(path) {
  if (!path) return null;
  return SUPABASE_URL + "/storage/v1/object/public/board-photos/" + path;
}

// Fetches every comment across the whole board (oldest first within
// each post), for the client to group by post_id — mirrors the
// "client-side walk is simple and cheap at this scale" approach used by
// fetchHallOfFame() above, rather than a per-post round trip.
function fetchBoardComments() {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("board_comments")
    .select("*")
    .order("created_at", { ascending: true })
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
}

// "Check my replies" — the board has no email/push notifications (see
// supabase/board-replies-check-migration.sql for why), so a participant
// self-checks with the same name + PIN they post/comment with. Calls the
// PIN-gated check_board_replies() database function, which also marks
// this moment as "checked" server-side, so calling this twice in a row
// correctly returns [] the second time. Resolves with an array of rows
// (newest first), or rejects with an error whose .message is
// "not_registered" / "invalid_pin".
function checkBoardReplies(name, pinHash) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return supabaseClient
    .rpc("check_board_replies", { p_name: name, p_pin_hash: pinHash })
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
}

// "Curious" reactions on board posts — see
// supabase/board-curious-migration.sql. Fetches the current Curious count
// for every post (from the public board_curious_counts view, which never
// exposes who reacted, only how many) so the feed can show a number
// without anyone signing in. Resolves with [] if the backend isn't
// configured.
function fetchBoardCuriousCounts() {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("board_curious_counts")
    .select("*")
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
}

// Toggles this participant's Curious reaction on a post via
// toggle_post_curious() — same registration/active/PIN gating as posting
// or commenting. Resolves with { is_curious, curious_count } in one round
// trip. Rejects with an error whose .message is "not_registered" /
// "not_active" / "invalid_pin" / "post_not_found".
function toggleBoardCurious(postId, name, pinHash) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return supabaseClient
    .rpc("toggle_post_curious", { p_post_id: postId, p_name: name, p_pin_hash: pinHash })
    .then(function (res) {
      if (res.error) throw res.error;
      var row = Array.isArray(res.data) ? res.data[0] : res.data;
      return row || { is_curious: false, curious_count: 0 };
    });
}
