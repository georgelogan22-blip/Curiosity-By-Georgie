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
// supabase/registration-migration.sql) — this checks, in one call, that
// record.name is registered, active (not banned), and that
// record.pinHash matches the PIN hash stored at registration, before
// inserting. Resolves with the saved row. Rejects with an error whose
// .message is one of "not_registered", "not_active", or "invalid_pin"
// (raised by the database function) so the form can show a specific
// hint for each case — see assets/script.js.
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
    })
    .then(function (res) {
      if (res.error) throw res.error;
      return Array.isArray(res.data) ? res.data[0] : res.data;
    });
}

// Register a new participant (see supabase/registration-migration.sql).
// Resolves with the saved row, or rejects with the Supabase/Postgres
// error (err.code is the Postgres error code — e.g. "23505" for a
// duplicate display name, "23514" for the parental-consent check) so
// the form can show a friendly message for the common cases.
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
    .select()
    .single()
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
// supabase/points-migration.sql — the leaderboard view sums each
// participant's confirmed distinct species' tier points; species_count
// is still returned too, for display and for Hall of Fame eligibility).
function fetchLeaderboard(limit) {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("leaderboard")
    .select("*")
    .order("total_points", { ascending: false })
    .order("species_count", { ascending: false })
    .order("last_sighting", { ascending: false })
    .limit(limit || 25)
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
}

// Everyone with 50+ confirmed species, with the date each reached their
// fiftieth. Small dataset per participant, so the induction date is
// worked out here by walking their sightings in submission order, rather
// than with a heavier SQL window query.
function fetchHallOfFame() {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("leaderboard")
    .select("*")
    .gte("species_count", 50)
    .then(function (res) {
      if (res.error) throw res.error;
      var leaders = res.data || [];
      return Promise.all(
        leaders.map(function (leader) {
          return supabaseClient
            .from("sightings")
            .select("species_key, sighting_date, created_at")
            .eq("participant_key", leader.participant_key)
            .eq("status", "confirmed")
            .order("created_at", { ascending: true })
            .then(function (rowsRes) {
              if (rowsRes.error) throw rowsRes.error;
              var seen = {};
              var seenCount = 0;
              var inductedAt = null;
              var rows = rowsRes.data || [];
              for (var i = 0; i < rows.length; i++) {
                var key = rows[i].species_key;
                if (!seen[key]) {
                  seen[key] = true;
                  seenCount++;
                  if (seenCount >= 50) {
                    inductedAt = rows[i].sighting_date;
                    break;
                  }
                }
              }
              return {
                name: leader.participant_name,
                count: leader.species_count,
                points: leader.total_points,
                inductedAt: inductedAt,
              };
            });
        })
      );
    })
    .then(function (results) {
      results.sort(function (a, b) {
        var da = a.inductedAt || "";
        var db = b.inductedAt || "";
        return da < db ? -1 : da > db ? 1 : 0;
      });
      return results;
    });
}
