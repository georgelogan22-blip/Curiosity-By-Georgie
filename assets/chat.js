// Curiously Georgie — Community Board ("Chat")
//
// Renders the board feed from a single in-memory `posts` array, owned
// entirely by this script (same approach as log-sighting.html's session
// feed) — this keeps the "post a comment" flow simple even before any
// real posts exist. On load, real posts (if any) replace the example
// seed data; posting/commenting always try the real backend first and
// fall back to appending locally (clearly marked "demo mode") when it
// isn't configured or the save fails for a reason other than a
// registration/PIN problem — same graceful-degradation posture as
// assets/script.js.

// Sorts a loaded board photo into one of three Instagram-style frames —
// square, portrait (4:5), or landscape (1.91:1) — based on its own actual
// pixel dimensions, so assets/styles.css's object-fit: cover only ever
// trims a small excess margin instead of squeezing every photo (most of
// which are tall phone shots) into one fixed shape and cropping the bird
// out. Wired up via an inline onload on each <img class="board-post-photo">
// (see renderPost() below) rather than an addEventListener, since posts
// are inserted via innerHTML and the image may finish loading before any
// listener attached after the fact would have a chance to catch it.
window.classifyBoardPhoto = function (img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  var ratio = img.naturalWidth / img.naturalHeight;
  img.classList.remove("shape-square", "shape-portrait", "shape-landscape");
  if (ratio > 1.15) img.classList.add("shape-landscape");
  else if (ratio < 0.85) img.classList.add("shape-portrait");
  else img.classList.add("shape-square");
};

document.addEventListener("DOMContentLoaded", function () {
  var feed = document.getElementById("board-feed");
  var note = document.getElementById("board-note");
  var composer = document.getElementById("board-composer");
  if (!feed || !composer) return;

  var nameField = document.getElementById("board-name");
  var pinField = document.getElementById("board-pin");
  var captionField = document.getElementById("board-caption");
  var photoField = document.getElementById("board-photo");
  var statusEl = document.getElementById("board-status");

  // Example seed data — matches what's statically painted in chat.html,
  // so there's no visible flash on load; replaced wholesale the moment
  // real posts come back from fetchBoardPosts().
  var posts = [
    {
      id: "example-1",
      name: "Priya N.",
      time: new Date("2026-09-03T07:42:00+10:00"),
      caption: "Finally caught a Powerful Owl roosting near the Mt Coot-tha lookout track this morning — anyone else seen one this month?",
      photoUrl: null,
      comments: [
        { id: "c1", name: "Chen W.", body: "Yes! Same patch of fig trees, about a week ago. They seem to like it there." },
      ],
    },
    {
      id: "example-2",
      name: "Sam R.",
      time: new Date("2026-09-01T18:15:00+10:00"),
      caption: "Anyone found a lightweight scope that doesn't break the bank? Looking to upgrade from binoculars before the next challenge variant drops.",
      photoUrl: null,
      comments: [],
    },
    {
      id: "example-3",
      name: "Marco D.",
      time: new Date("2026-08-30T09:03:00+10:00"),
      caption: "Keen for a group walk through New Farm Park this Saturday morning if a few of us want to compare notes — reply here if you're in!",
      photoUrl: null,
      comments: [],
    },
  ];

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function formatTime(date) {
    if (!date || isNaN(date.getTime())) return "";
    return date.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }

  function renderComment(c) {
    return (
      '<div class="board-comment">' +
      '<span class="board-comment-name">' + escapeHtml(c.name) + "</span>" +
      '<span class="board-comment-body">' + escapeHtml(c.body) + "</span>" +
      "</div>"
    );
  }

  function renderPost(post) {
    var photoBit = post.photoUrl
      ? '<img class="board-post-photo" src="' + escapeHtml(post.photoUrl) + '" alt="" loading="lazy" onload="window.classifyBoardPhoto(this)">'
      : "";
    return (
      '<article class="board-post" data-post-id="' + escapeHtml(post.id) + '">' +
      '<div class="board-post-head">' +
      '<span class="board-post-name">' + escapeHtml(post.name) + "</span>" +
      '<span class="board-post-time">' + escapeHtml(formatTime(post.time)) + "</span>" +
      "</div>" +
      '<p class="board-post-caption">' + escapeHtml(post.caption) + "</p>" +
      photoBit +
      '<div class="board-comments">' + post.comments.map(renderComment).join("") + "</div>" +
      '<form class="board-comment-form" data-post-id="' + escapeHtml(post.id) + '">' +
      '<textarea name="body" maxlength="300" placeholder="Add a comment…" required></textarea>' +
      '<button type="submit" class="btn btn-ghost">Comment</button>' +
      "</form>" +
      "</article>"
    );
  }

  function renderFeed() {
    feed.innerHTML = posts.map(renderPost).join("");
  }

  function setStatus(html) {
    if (!statusEl) return;
    statusEl.hidden = !html;
    statusEl.innerHTML = html || "";
  }

  function setNote(html) {
    if (!note) return;
    note.innerHTML = '<span class="dot"></span>' + html;
  }

  // ---- load the real feed, if any -------------------------------------
  if (typeof fetchBoardPosts === "function" && typeof fetchBoardComments === "function") {
    Promise.all([fetchBoardPosts(100), fetchBoardComments()])
      .then(function (results) {
        var rows = results[0];
        var commentRows = results[1];
        if (!rows || !rows.length) return; // keep example posts until real ones exist
        var commentsByPost = {};
        (commentRows || []).forEach(function (c) {
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push({ id: c.id, name: c.participant_name, body: c.body });
        });
        posts = rows.map(function (r) {
          return {
            id: r.id,
            name: r.participant_name,
            time: new Date(r.created_at),
            caption: r.caption,
            photoUrl: typeof boardPhotoUrl === "function" ? boardPhotoUrl(r.photo_path) : null,
            comments: commentsByPost[r.id] || [],
          };
        });
        setNote("Live — showing everyone's posts.");
        renderFeed();
      })
      .catch(function () {
        // Fetch failed (network hiccup, backend not configured) — keep
        // showing the example posts rather than an empty/broken board.
      });
  }

  // ---- posting a new entry --------------------------------------------
  function findPost(id) {
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === id) return posts[i];
    }
    return null;
  }

  composer.addEventListener("submit", function (evt) {
    evt.preventDefault();
    var caption = (captionField.value || "").trim();
    var name = (nameField.value || "").trim();
    var pin = (pinField.value || "").trim();
    if (!caption) return;

    if (!name) {
      setStatus("Enter your name to post.");
      return;
    }
    if (!/^[0-9]{4}$/.test(pin)) {
      setStatus("Enter the 4-digit PIN you chose when you registered.");
      return;
    }

    var photoFile = photoField && photoField.files && photoField.files[0];
    var submitBtn = composer.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Checking your registration…");

    var checkStatus = typeof participantStatus === "function"
      ? participantStatus(name)
      : Promise.resolve(null);

    checkStatus
      .catch(function () {
        return "unknown";
      })
      .then(function (status) {
        if (status === null) {
          setStatus('You\'ll need to <a href="register.html">register</a> first — it only takes a minute, then come back and post here under the same name.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        if (status === "banned") {
          setStatus('This name isn\'t able to post here. If you think this is a mistake, email <a href="mailto:contactcuriouslygeorgie@gmail.com">contactcuriouslygeorgie@gmail.com</a>.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        var record = { name: name, caption: caption };
        var uploadStep = photoFile && typeof uploadBoardPhoto === "function"
          ? (setStatus("Uploading photo…"), uploadBoardPhoto(photoFile))
          : Promise.resolve(null);

        var save = uploadStep
          .then(function (photoPath) {
            record.photoPath = photoPath;
            setStatus("Posting…");
            return typeof hashPin === "function" ? hashPin(pin) : Promise.reject(new Error("offline-demo"));
          })
          .then(function (pinHash) {
            record.pinHash = pinHash;
            return typeof createBoardPost === "function"
              ? createBoardPost(record)
              : Promise.reject(new Error("offline-demo"));
          });

        return save
          .then(function (row) {
            posts.unshift({
              id: row.id,
              name: row.participant_name,
              time: new Date(row.created_at),
              caption: row.caption,
              photoUrl: typeof boardPhotoUrl === "function" ? boardPhotoUrl(row.photo_path) : null,
              comments: [],
            });
            setNote("Live — showing everyone's posts.");
            renderFeed();
            setStatus("Posted!");
            composer.reset();
            try { window.localStorage.setItem("cg_participant_name", name); } catch (e) {}
          })
          .catch(function (err) {
            var msg = err && err.message;
            if (msg === "offline-demo") {
              // Backend not configured (or a genuine network failure) —
              // still show the post locally so the board feels alive,
              // clearly marked as not actually saved anywhere.
              var localPhotoUrl = photoFile && typeof URL !== "undefined" && URL.createObjectURL
                ? URL.createObjectURL(photoFile)
                : null;
              posts.unshift({
                id: "local-" + Date.now(),
                name: name,
                time: new Date(),
                caption: caption,
                photoUrl: localPhotoUrl,
                comments: [],
              });
              renderFeed();
              setNote("Demo mode — this board isn't connected right now, so posts here aren't saved anywhere.");
              setStatus("Posted locally — demo mode, not saved anywhere.");
              composer.reset();
            } else if (msg === "not_registered" || (err && err.code === "42501")) {
              setStatus('That name isn\'t registered yet — <a href="register.html">register here</a>, then post again.');
            } else if (msg === "not_active") {
              setStatus('This name isn\'t able to post here. If you think this is a mistake, email <a href="mailto:contactcuriouslygeorgie@gmail.com">contactcuriouslygeorgie@gmail.com</a>.');
            } else if (msg === "invalid_pin") {
              setStatus('<span class="status-warn">That PIN doesn\'t match this name — check it and try again.</span>');
            } else if (msg === "caption_required") {
              setStatus("Say a little something before posting.");
            } else {
              setStatus("Couldn't reach the board right now — please try again.");
            }
          })
          .then(function () {
            if (submitBtn) submitBtn.disabled = false;
          });
      });
  });

  // ---- commenting (event delegation — forms are re-rendered) ----------
  feed.addEventListener("submit", function (evt) {
    var form = evt.target.closest(".board-comment-form");
    if (!form) return;
    evt.preventDefault();

    var postId = form.getAttribute("data-post-id");
    var textarea = form.querySelector("textarea[name=\"body\"]");
    var body = (textarea && textarea.value || "").trim();
    var name = (nameField.value || "").trim();
    var pin = (pinField.value || "").trim();
    if (!body) return;

    if (!name) {
      setStatus("Enter your name above to comment.");
      return;
    }
    if (!/^[0-9]{4}$/.test(pin)) {
      setStatus("Enter your 4-digit PIN above to comment.");
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    var checkStatus = typeof participantStatus === "function"
      ? participantStatus(name)
      : Promise.resolve(null);

    checkStatus
      .catch(function () {
        return "unknown";
      })
      .then(function (status) {
        if (status === null) {
          setStatus('You\'ll need to <a href="register.html">register</a> first — it only takes a minute, then come back and comment under the same name.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        if (status === "banned") {
          setStatus('This name isn\'t able to comment here. If you think this is a mistake, email <a href="mailto:contactcuriouslygeorgie@gmail.com">contactcuriouslygeorgie@gmail.com</a>.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        var save = typeof hashPin === "function"
          ? hashPin(pin).then(function (pinHash) {
              return typeof createBoardComment === "function"
                ? createBoardComment({ postId: postId, name: name, pinHash: pinHash, body: body })
                : Promise.reject(new Error("offline-demo"));
            })
          : Promise.reject(new Error("offline-demo"));

        return save
          .then(function (row) {
            var post = findPost(postId);
            if (post) {
              post.comments.push({ id: row.id, name: row.participant_name, body: row.body });
              renderFeed();
            }
            try { window.localStorage.setItem("cg_participant_name", name); } catch (e) {}
          })
          .catch(function (err) {
            var msg = err && err.message;
            if (msg === "offline-demo") {
              var post = findPost(postId);
              if (post) {
                post.comments.push({ id: "local-" + Date.now(), name: name, body: body });
                renderFeed();
                setNote("Demo mode — this board isn't connected right now, so comments here aren't saved anywhere.");
              }
            } else if (msg === "not_registered") {
              setStatus('That name isn\'t registered yet — <a href="register.html">register here</a>, then comment again.');
            } else if (msg === "not_active") {
              setStatus('This name isn\'t able to comment here. If you think this is a mistake, email <a href="mailto:contactcuriouslygeorgie@gmail.com">contactcuriouslygeorgie@gmail.com</a>.');
            } else if (msg === "invalid_pin") {
              setStatus('<span class="status-warn">That PIN doesn\'t match this name — check it and try again.</span>');
            } else if (msg === "post_not_found") {
              setStatus("That post isn't there anymore.");
            } else {
              setStatus("Couldn't reach the board right now — please try again.");
            }
          })
          .then(function () {
            if (submitBtn) submitBtn.disabled = false;
          });
      });
  });

  // Pre-fill the name field if this browser has posted/registered
  // before — same convenience as log-sighting.html.
  if (nameField && !nameField.value) {
    try {
      var savedName = window.localStorage.getItem("cg_participant_name");
      if (savedName) nameField.value = savedName;
    } catch (e) {
      // localStorage unavailable — fine, just means no prefill.
    }
  }
});
