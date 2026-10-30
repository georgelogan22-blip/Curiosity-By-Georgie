// Curiosity by Georgie — Supabase client + data helpers
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

// Pre-flight PIN check, called first by every PIN-gated function below,
// via the record_pin_attempt() database function (see
// supabase/pin-lockout-fix-migration.sql). This is its own separate
// round trip rather than folded into the real action's own call, because
// of a Postgres gotcha found 2026-10-28: if a database function updates a
// row and then raises an exception in that same call, Postgres rolls
// back the WHOLE transaction — including that update — the moment the
// exception escapes uncaught. check_pin() does exactly that (update the
// failed-attempt counter, then raise 'invalid_pin'), so the counter
// update was always being silently undone and the lockout could never
// actually trigger. record_pin_attempt() does the same lock-check /
// counter logic but returns a plain "ok" / "invalid_pin" / "pin_locked"
// result instead of raising for those two cases, so its update commits
// normally as part of this call's own transaction. Once this resolves,
// the real action below still runs its own check_pin() exactly as
// before — same PIN, same stored hash, so it always passes cleanly; this
// doesn't replace check_pin(), it just makes sure the attempt that got
// us here was actually counted. Rejects with an error whose .message is
// "not_registered", "invalid_pin", or "pin_locked" — same error
// vocabulary every PIN-gated call already used, so no page needs to
// change how it reads the error.
function verifyPinAttempt(name, pinHash) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return supabaseClient
    .rpc("record_pin_attempt", { p_name: name, p_pin_hash: pinHash })
    .then(function (res) {
      if (res.error) throw res.error;
      if (res.data === "invalid_pin") throw new Error("invalid_pin");
      if (res.data === "pin_locked") throw new Error("pin_locked");
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
  return verifyPinAttempt(record.name, record.pinHash).then(function () {
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
        p_photo_gps_lat: typeof record.photoGpsLat === "number" ? record.photoGpsLat : null,
        p_photo_gps_lng: typeof record.photoGpsLng === "number" ? record.photoGpsLng : null,
        p_photo_captured_at: record.photoCapturedAt || null,
        p_photo_exif: record.photoExif || null,
      })
      .then(function (res) {
        if (res.error) throw res.error;
        return Array.isArray(res.data) ? res.data[0] : res.data;
      });
  });
}

// Shrinks an image file to at most `maxDim` px on its longest edge before
// upload, by drawing it to a canvas and re-encoding as JPEG. Modern phone
// cameras routinely produce multi-MB, 3000px+ photos — uploading those
// as-is is the most likely thing to fail or stall for someone submitting
// from a park on patchy mobile signal, which is exactly this site's real
// use case. Deliberately independent of readPhotoExifSummary() below:
// that function always reads EXIF from the *original* File the user
// picked (never from the resized copy this function returns), because a
// canvas re-encode strips EXIF entirely — so capture-date/GPS/camera
// verification keeps working exactly as before, unaffected by this. Never rejects: if the
// browser can't decode the file (unsupported format, corrupt image) or
// canvas isn't available, it resolves with the original, untouched file
// so the upload can still proceed rather than being blocked by this
// optimization. Modern browsers already auto-apply EXIF orientation when
// decoding for <img>/canvas, so no separate rotation handling is needed.
function resizeImageForUpload(file, maxDim, quality) {
  maxDim = maxDim || 1600;
  quality = quality || 0.82;
  if (!file || !/^image\//.test(file.type || "") || typeof document === "undefined") {
    return Promise.resolve(file);
  }
  return new Promise(function (resolve) {
    var settled = false;
    var url = URL.createObjectURL(file);
    function finish(result) {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(result);
    }
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h || Math.max(w, h) <= maxDim) {
        finish(file); // Already small enough — skip the re-encode.
        return;
      }
      var scale = maxDim / Math.max(w, h);
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            finish(file);
            return;
          }
          finish(new File([blob], file.name || "photo.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = function () {
      finish(file); // Couldn't decode — fall back to the original file.
    };
    img.src = url;
  });
}

// Uploads the evidence photo to the public "sighting-photos" Storage
// bucket (see photo-verification-migration.sql) ahead of the actual
// submit_sighting() call, and resolves with the storage path to pass in
// as record.photoPath. Each photo gets a random, collision-proof name —
// the original filename is never used or stored, so it can't leak
// anything about the participant's device or photo library. Resized via
// resizeImageForUpload() first — see that function's comment for why
// this doesn't affect EXIF-based capture-date verification.
function uploadSightingPhoto(file) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return resizeImageForUpload(file).then(function (uploadFile) {
    var ext = (uploadFile.name && uploadFile.name.indexOf(".") !== -1)
      ? uploadFile.name.slice(uploadFile.name.lastIndexOf(".") + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
      : "jpg";
    var id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    var path = id + "." + (ext || "jpg");
    return supabaseClient.storage
      .from("sighting-photos")
      .upload(path, uploadFile, { contentType: uploadFile.type || "image/jpeg", upsert: false })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data.path;
      });
  });
}

// Reads everything this site wants out of a sighting photo's EXIF data in
// one pass — originally four separate exifr.parse() calls (capture date,
// GPS, full capture timestamp, and now camera fingerprint), consolidated
// here on 2026-10-30 since exifr.parse() always reads the whole tag set
// regardless of what's picked out of it afterwards, so calling it four
// times over just meant three wasted re-parses of the same file.
//
// Must be called on the original File the user picked, before any
// resize/re-encode — resizeImageForUpload()'s canvas round-trip strips
// EXIF entirely as a side effect, so capture-date/GPS/camera verification
// always reads from the untouched original, independent of whatever
// (possibly smaller) copy ends up uploaded.
//
// Note: exifr.parse(file, [...]) — the array-shorthand "pick" form —
// throws in the exifr build this site loads ("undefined is not
// iterable"). Calling parse() with no options reads the full tag set
// reliably; the fields below are picked out of it manually instead.
//
// Resolves with:
//   { takenDate, capturedAt, gpsLat, gpsLng, camera }
// — takenDate: "YYYY-MM-DD" string or null (what the launch-date check in
//   supabase/functions/verify-sighting compares against — a screenshot or
//   a photo with its metadata stripped shows up as "no date" rather than
//   silently passing).
// — capturedAt: full ISO 8601 timestamp string or null — same underlying
//   EXIF field as takenDate, just not truncated to a bare date. Captured
//   for George's own records; nothing the site decides on uses this
//   directly. Caveat worth knowing: EXIF's capture-time field carries no
//   timezone of its own — this reads it as the browser's current local
//   timezone at upload time, correct for the ordinary case (Queensland,
//   no daylight saving) but possibly a few hours off for a photo taken
//   while travelling, or from a device with its clock/timezone set wrong.
// — gpsLat/gpsLng: numbers or null — read for George's own private
//   play-zone/boundary verification (see
//   supabase/gps-capture-migration.sql's comment); never shown anywhere
//   public. The public photo itself still goes through
//   resizeImageForUpload() exactly as before, which strips this, so
//   anyone viewing a sighting's photo sees no location metadata either
//   way — this only feeds the private photo_gps_lat/photo_gps_lng columns
//   on George's review dashboard.
// — camera: { make, model, lensModel, software, iso, fNumber,
//   exposureTime, focalLength } with only the fields actually present, or
//   null if none of these were readable at all. Used by
//   verify-sighting's camera-fingerprint check (added 2026-10-30) as a
//   soft signal — see that function's header comment for why a missing
//   fingerprint alone proves nothing.
// Any of the above can come back null independently — a photo can have a
// date but no GPS, GPS but no camera make, and so on; that's normal and
// expected, not an error.
function readPhotoExifSummary(file) {
  var empty = { takenDate: null, capturedAt: null, gpsLat: null, gpsLng: null, camera: null };
  if (typeof exifr === "undefined") return Promise.resolve(empty);
  return exifr
    .parse(file)
    .then(function (tags) {
      if (!tags) return empty;

      var takenDate = null;
      var capturedAt = null;
      var d = tags.DateTimeOriginal || tags.CreateDate;
      if (d) {
        var date = d instanceof Date ? d : new Date(d);
        if (!isNaN(date.getTime())) {
          takenDate = date.toISOString().slice(0, 10);
          capturedAt = date.toISOString();
        }
      }

      var gpsLat = typeof tags.latitude === "number" && !isNaN(tags.latitude) ? tags.latitude : null;
      var gpsLng = typeof tags.longitude === "number" && !isNaN(tags.longitude) ? tags.longitude : null;

      var camera = null;
      var cameraFields = {
        make: tags.Make,
        model: tags.Model,
        lensModel: tags.LensModel,
        software: tags.Software,
        iso: tags.ISO,
        fNumber: tags.FNumber,
        exposureTime: tags.ExposureTime,
        focalLength: tags.FocalLength,
      };
      Object.keys(cameraFields).forEach(function (key) {
        var value = cameraFields[key];
        if (value === undefined || value === null || value === "") return;
        camera = camera || {};
        camera[key] = value;
      });

      return { takenDate: takenDate, capturedAt: capturedAt, gpsLat: gpsLat, gpsLng: gpsLng, camera: camera };
    })
    .catch(function () {
      return empty;
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

// Calls request_pin_reset() (see supabase/pin-reset-migration.sql) — if
// this display name is registered and active, it queues a reset email;
// either way this always resolves, never revealing whether the name
// exists, so the caller can show the same "if that name is registered…"
// message regardless. See forgot-pin.html.
function requestPinReset(name) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return supabaseClient.rpc("request_pin_reset", { p_display_name: name }).then(function (res) {
    if (res.error) throw res.error;
  });
}

// Calls redeem_pin_reset() (see supabase/pin-reset-migration.sql) to set
// a new PIN once someone's followed their emailed link. newPinHash is the
// SHA-256 digest from hashPin(), same as everywhere else on the site —
// the raw new PIN is never sent here. Rejects with an error whose
// .message is one of "invalid_token", "token_used", or "token_expired"
// (raised by the database function) so reset-pin.html can show a
// specific message for each case. See that page.
function redeemPinReset(token, newPinHash) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return supabaseClient
    .rpc("redeem_pin_reset", { p_token: token, p_new_pin_hash: newPinHash })
    .then(function (res) {
      if (res.error) throw res.error;
    });
}

// Calls submit_contact_message() (see supabase/contact-migration.sql) —
// the backend for contact.html, built to replace every mailto: link on
// the site (see that migration's header comment for why). Rejects with
// an error whose .message is "invalid_email", "message_too_short", or
// "message_too_long" (raised by the database function) so contact.js
// can show a specific message for each case, or with new Error(
// "offline-demo") if the backend isn't configured.
function submitContactMessage(record) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return supabaseClient
    .rpc("submit_contact_message", {
      p_name: record.name || null,
      p_email: record.email,
      p_topic: record.topic || "general",
      p_message: record.message,
      p_page: record.page || null,
    })
    .then(function (res) {
      if (res.error) throw res.error;
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
//
// Pass a number to cap how many rows come back (used nowhere currently —
// kept for any future caller that wants a short top-N list), or pass
// null/undefined for every row. leaderboard.html now always asks for the
// full board (null) — needed both for its own name/registration-number
// search (so it can find someone outside a "top 25" cutoff) and for My
// Sightings' "Your Leaderboard Position" panel (assets/my-sightings.js),
// which fetches the same full list client-side and finds the current
// participant's own row in it rather than needing a separate backend
// endpoint.
function fetchLeaderboard(limit) {
  if (!supabaseClient) return Promise.resolve([]);
  var query = supabaseClient
    .from("leaderboard")
    .select("*")
    .order("total_points", { ascending: false })
    .order("air50_species_count", { ascending: false })
    .order("last_sighting", { ascending: false });
  if (limit) query = query.limit(limit);
  return query.then(function (res) {
    if (res.error) throw res.error;
    return res.data;
  });
}

// Finisher Rewards page: the coin's front design stays hidden behind a
// silhouette until the site-wide reveal condition is met — the first
// participant reaching 40 confirmed OFFICIAL species (George's decision,
// 2026-09-27 — matches the "Air Veteran" level in assets/my-sightings.js;
// "Air Master" itself now means all 50, same as the coin's engraving).
// This only needs the single highest air50_species_count on the board, so
// it asks for exactly one row ordered by that column rather than the whole
// leaderboard fetchLeaderboard() above pulls. Same public "leaderboard"
// view/grant as fetchLeaderboard() — no extra backend work needed.
function fetchTopAir50Count() {
  if (!supabaseClient) return Promise.resolve(0);
  return supabaseClient
    .from("leaderboard")
    .select("air50_species_count")
    .order("air50_species_count", { ascending: false })
    .limit(1)
    .then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      return rows.length ? rows[0].air50_species_count || 0 : 0;
    });
}

// Everyone George has actually PUBLISHED to the Hall of Fame — see
// supabase/hall-of-fame-multi-discipline-migration.sql. Reaching
// air50_species_count >= 50 on the leaderboard (all 50 OFFICIAL Brisbane
// Air 50 species confirmed) only makes someone ELIGIBLE for induction; it
// no longer publishes them automatically. George's decision, 2026-09-13:
// before anyone goes up permanently, he does one final manual look back
// over that participant's 50 confirmed sightings (their evidence photos
// are already sitting in storage from when each was originally logged —
// no new submission needed) and only then adds their induction row.
//
// George's decision, 2026-10-11: as the Brisbane 250 grows beyond Air 50
// (Land 50, Water 50, etc.), one participant can be inducted into MORE
// than one discipline over time — each with its own induction date and
// its own "first fifty" numbering, independent of the others. So this
// resolves to one entry PER PARTICIPANT (not per induction row), each
// carrying a `medals` array of every discipline they've been inducted
// into, oldest first. Participants are themselves ordered by their
// EARLIEST medal's date — the first person ever inducted, to ANYTHING,
// stays on top for good, even if someone else later beats them to a
// second or third discipline.
function fetchHallOfFame() {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("hall_of_fame_inductions")
    .select("participant_key, discipline, inducted_at")
    .order("inducted_at", { ascending: true })
    .then(function (indRes) {
      if (indRes.error) throw indRes.error;
      var inductions = indRes.data || [];
      if (!inductions.length) return [];

      // Finisher number = this row's 1-based rank within its OWN
      // discipline's induction order — Air 50's first-ever finisher is
      // "#001" independently of when Land 50's own first finisher shows
      // up, and so on for every future discipline. `inductions` is
      // already sorted inducted_at ascending, so a running
      // per-discipline counter gets the right number in one pass.
      var disciplineCounts = {};
      inductions.forEach(function (ind) {
        disciplineCounts[ind.discipline] = (disciplineCounts[ind.discipline] || 0) + 1;
        ind.finisherNumber = disciplineCounts[ind.discipline];
      });

      return supabaseClient
        .from("leaderboard")
        .select("*")
        .then(function (lbRes) {
          if (lbRes.error) throw lbRes.error;
          var byKey = {};
          (lbRes.data || []).forEach(function (row) {
            byKey[row.participant_key] = row;
          });

          // Group every induction row under its participant, keeping
          // each participant's own medals in the order they earned
          // them. `order` ends up earliest-participant-first too, since
          // a participant is only pushed onto it the first time we see
          // one of their rows — i.e. at their earliest medal.
          var order = [];
          var byParticipant = {};
          inductions.forEach(function (ind) {
            if (!byParticipant[ind.participant_key]) {
              byParticipant[ind.participant_key] = [];
              order.push(ind.participant_key);
            }
            byParticipant[ind.participant_key].push(ind);
          });

          return order.map(function (key) {
            var lb = byKey[key] || {};
            return {
              name: lb.participant_name || key,
              // species_count/total_points off the "leaderboard" view
              // are Air 50-specific (see points-migration.sql) — no
              // other discipline has its own scoring/leaderboard view
              // yet, so this stays one flat field on the participant
              // rather than per-medal until a second discipline gets
              // its own stats source.
              count: lb.species_count,
              points: lb.total_points,
              avatarKey: lb.avatar_key || null,
              avatarPhotoUrl: avatarPhotoUrl(lb.avatar_photo_path),
              foundingFlockRank: lb.founding_flock_rank || null,
              medals: byParticipant[key].map(function (ind) {
                return {
                  discipline: ind.discipline,
                  inductedAt: ind.inducted_at,
                  finisherNumber: ind.finisherNumber,
                };
              }),
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
  return verifyPinAttempt(name, pinHash).then(function () {
    return supabaseClient
      .rpc("participant_sightings", { p_name: name, p_pin_hash: pinHash })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data || [];
      });
  });
}

// Same name+PIN gate as fetchMySightings, for the My Sightings
// dashboard's profile header — display name, chosen avatar, and the
// same species_count/total_points the public Leaderboard shows (see
// supabase/avatar-migration.sql's participant_dashboard()). Resolves
// with a single { display_name, avatar_key, species_count, total_points }
// object rather than an array, since it's always exactly one row.
function fetchParticipantDashboard(name, pinHash) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return verifyPinAttempt(name, pinHash).then(function () {
    return supabaseClient
      .rpc("participant_dashboard", { p_name: name, p_pin_hash: pinHash })
      .then(function (res) {
        if (res.error) throw res.error;
        return (res.data && res.data[0]) || null;
      });
  });
}

// Saves the bird character chosen on the dashboard — avatarKey must be
// one of the keys in assets/avatars.js (also enforced server-side by
// update_participant_avatar()'s own check). Pass null to clear back to
// no avatar chosen.
function updateParticipantAvatar(name, pinHash, avatarKey) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return verifyPinAttempt(name, pinHash).then(function () {
    return supabaseClient
      .rpc("update_participant_avatar", { p_name: name, p_pin_hash: pinHash, p_avatar_key: avatarKey })
      .then(function (res) {
        if (res.error) throw res.error;
        return true;
      });
  });
}

// ---------------------------------------------------------------------
// Avatar photo uploads — see supabase/avatar-photo-migration.sql.
// George's call: a photo goes live the moment it's uploaded (no review
// queue, same posture as Community Board photos), and it's shown
// wherever that participant's name appears — Leaderboard, Hall of Fame,
// the Community Board, and My Sightings — not just the dashboard. A
// photo always wins over the chosen icon when both are set.
// ---------------------------------------------------------------------

// Uploads a new avatar photo to the public "avatar-photos" Storage
// bucket and resolves with its storage path, to pass into
// updateParticipantAvatarPhoto(). Same resize-then-random-filename
// approach as every other photo upload on the site.
function uploadAvatarPhoto(file) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return resizeImageForUpload(file).then(function (uploadFile) {
    var ext = (uploadFile.name && uploadFile.name.indexOf(".") !== -1)
      ? uploadFile.name.slice(uploadFile.name.lastIndexOf(".") + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
      : "jpg";
    var id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    var path = id + "." + (ext || "jpg");
    return supabaseClient.storage
      .from("avatar-photos")
      .upload(path, uploadFile, { contentType: uploadFile.type || "image/jpeg", upsert: false })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data.path;
      });
  });
}

// Saves (or, passing null, removes) the participant's uploaded avatar
// photo via update_participant_avatar_photo() — same PIN-gated pattern
// as updateParticipantAvatar(). Removing reverts the front end to
// whichever icon they last chose (or the neutral placeholder).
function updateParticipantAvatarPhoto(name, pinHash, photoPath) {
  if (!supabaseClient) return Promise.reject(new Error("offline-demo"));
  return verifyPinAttempt(name, pinHash).then(function () {
    return supabaseClient
      .rpc("update_participant_avatar_photo", { p_name: name, p_pin_hash: pinHash, p_photo_path: photoPath })
      .then(function (res) {
        if (res.error) throw res.error;
        return true;
      });
  });
}

// Builds the public URL for a photo already uploaded to the
// avatar-photos bucket (avatar_photo_path as stored on a participants
// row) — same pattern as boardPhotoUrl() below.
function avatarPhotoUrl(path) {
  if (!path) return null;
  return SUPABASE_URL + "/storage/v1/object/public/avatar-photos/" + path;
}

// The narrow public lookup behind Community Board avatars — see
// public.participant_avatars in supabase/avatar-photo-migration.sql.
// Resolves with every participant's { participant_key, avatar_key,
// avatar_photo_path }, for the client to match against board post/
// comment author names (which are stored denormalised, with no foreign
// key to participants) — see assets/chat.js. Leaderboard rows and Hall
// of Fame cards don't need this: they get their avatar columns directly
// from the leaderboard view instead.
function fetchParticipantAvatars() {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("participant_avatars")
    .select("*")
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
// used or stored. Resized via resizeImageForUpload() first, same as
// sighting photos — the board has no EXIF/date verification depending on
// the original file, so there's nothing else to keep in sync here.
function uploadBoardPhoto(file) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return resizeImageForUpload(file).then(function (uploadFile) {
    var ext = (uploadFile.name && uploadFile.name.indexOf(".") !== -1)
      ? uploadFile.name.slice(uploadFile.name.lastIndexOf(".") + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
      : "jpg";
    var id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    var path = id + "." + (ext || "jpg");
    return supabaseClient.storage
      .from("board-photos")
      .upload(path, uploadFile, { contentType: uploadFile.type || "image/jpeg", upsert: false })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data.path;
      });
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
  return verifyPinAttempt(record.name, record.pinHash).then(function () {
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
  return verifyPinAttempt(record.name, record.pinHash).then(function () {
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
  });
}

// Deletes one of *this participant's own* posts via delete_board_post()
// (security definer — checks registration/active/PIN, then confirms the
// post actually belongs to this name, before removing it; see
// supabase/board-delete-migration.sql). Removing someone else's post is
// still dashboard-only for George, same as always — this only ever
// targets record.name's own posts, enforced server-side regardless of
// what the client sends. record: { id, name, pinHash }. Rejects with an
// error whose .message is "not_registered" / "not_active" /
// "invalid_pin" / "post_not_found" / "not_your_post".
function deleteBoardPost(record) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return verifyPinAttempt(record.name, record.pinHash).then(function () {
    return supabaseClient
      .rpc("delete_board_post", {
        p_post_id: record.id,
        p_name: record.name,
        p_pin_hash: record.pinHash,
      })
      .then(function (res) {
        if (res.error) throw res.error;
      });
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
  return verifyPinAttempt(name, pinHash).then(function () {
    return supabaseClient
      .rpc("check_board_replies", { p_name: name, p_pin_hash: pinHash })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data || [];
      });
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
  return verifyPinAttempt(name, pinHash).then(function () {
    return supabaseClient
      .rpc("toggle_post_curious", { p_post_id: postId, p_name: name, p_pin_hash: pinHash })
      .then(function (res) {
        if (res.error) throw res.error;
        var row = Array.isArray(res.data) ? res.data[0] : res.data;
        return row || { is_curious: false, curious_count: 0 };
      });
  });
}

// Homepage "City-wide so far" strip — see
// supabase/citywide-stats-migration.sql. Calls the public
// citywide_stats() function (SECURITY DEFINER, so it can count
// `participants` despite anon having no SELECT grant on that table —
// see the migration file's comments) and normalises the single-row
// result to plain numbers. Resolves with null if the backend isn't
// configured OR the migration hasn't been run yet (unknown RPC —
// PostgREST returns an error, which the caller's .catch() turns into
// "keep showing the placeholder" rather than a broken page), so this is
// safe to ship ahead of George actually running the SQL file.
function fetchCityWideStats() {
  if (!supabaseClient) return Promise.resolve(null);
  return supabaseClient
    .rpc("citywide_stats")
    .then(function (res) {
      if (res.error) throw res.error;
      var row = Array.isArray(res.data) ? res.data[0] : res.data;
      if (!row) return null;
      return {
        participantCount: Number(row.participant_count) || 0,
        speciesCount: Number(row.species_count) || 0,
        hallOfFamerCount: Number(row.hall_of_famer_count) || 0
      };
    });
}
