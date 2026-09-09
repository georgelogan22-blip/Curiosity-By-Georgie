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

// Submit one sighting. Resolves with the saved row, or rejects if the
// backend isn't configured yet / the request fails.
function submitSighting(record) {
  if (!supabaseClient) {
    return Promise.reject(new Error("offline-demo"));
  }
  return supabaseClient
    .from("sightings")
    .insert({
      participant_name: record.name,
      species: record.species,
      sighting_date: record.date,
      location: record.location || null,
      notes: record.notes || null,
    })
    .select()
    .single()
    .then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
}

// Top N participants by confirmed unique-species count.
function fetchLeaderboard(limit) {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from("leaderboard")
    .select("*")
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
