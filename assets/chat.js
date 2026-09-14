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
      curiousCount: 5,
      iAmCurious: false,
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
      curiousCount: 1,
      iAmCurious: false,
      comments: [],
    },
    {
      id: "example-3",
      name: "Marco D.",
      time: new Date("2026-08-30T09:03:00+10:00"),
      caption: "Keen for a group walk through New Farm Park this Saturday morning if a few of us want to compare notes — reply here if you're in!",
      photoUrl: null,
      curiousCount: 3,
      iAmCurious: false,
      comments: [],
    },
  ];

  // The "Beauty!" reaction button's icon — originally a magnifying glass
  // (echoing the site's explorer framing), swapped for the 🤙 "shaka"
  // emoji at George's request: it's technically the "call me" gesture,
  // but reads as a "hang loose"/rad-bro hand — matching the button's
  // dated, dad-joke charm.
  var CURIOUS_ICON_SVG = '<span class="board-curious-icon" aria-hidden="true">🤙</span>';

  // A wide, birding-themed emoji set for the comment box's emoji picker —
  // nature/gear emoji first (things people actually post about here),
  // then faces, hands/hearts, and general reactions.
  var COMMENT_EMOJI = [
    "🦅", "🦜", "🦉", "🦆", "🐦", "🦢", "🐣", "🦋",
    "🐝", "🌿", "🌳", "🌸", "🍃", "🌤️", "🌅", "🌊",
    "🔭", "📸", "😄", "😂", "🤩", "😍", "🥹", "🥰",
    "😲", "🙃", "😅", "🤯", "😎", "🥶", "🙄", "😴",
    "😬", "😇", "👍", "👎", "🙌", "👏", "🤝", "✌️",
    "🤙", "💪", "❤️", "🔥", "🎉", "✨", "⭐", "💯",
    "✅", "❓", "❗", "🤔", "🙏", "☕", "🍻", "👀",
    "🐧", "🦩", "🦚", "🦃", "🕊️", "☀️", "🌙", "🌈",
    "🌧️", "🍂", "🌾", "😆", "🤣", "🥳", "😊", "🤗",
    "😱", "🫡",
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

  function renderCuriousButton(post) {
    var activeClass = post.iAmCurious ? " is-curious" : "";
    var countBit = post.curiousCount > 0
      ? '<span class="board-curious-count">' + post.curiousCount + "</span>"
      : "";
    return (
      '<button type="button" class="board-curious-btn' + activeClass + '" data-post-id="' + escapeHtml(post.id) + '" aria-pressed="' + (post.iAmCurious ? "true" : "false") + '">' +
      CURIOUS_ICON_SVG +
      '<span class="board-curious-label">Beauty!</span>' +
      countBit +
      "</button>"
    );
  }

  function renderEmojiPicker() {
    return (
      '<div class="board-emoji-picker">' +
      COMMENT_EMOJI.map(function (e) {
        return '<button type="button" class="board-emoji-option" data-emoji="' + e + '">' + e + "</button>";
      }).join("") +
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
      '<div class="board-post-actions">' + renderCuriousButton(post) + "</div>" +
      '<form class="board-comment-form" data-post-id="' + escapeHtml(post.id) + '">' +
      '<div class="board-comment-input-row">' +
      '<textarea name="body" maxlength="300" placeholder="Add a comment…" required></textarea>' +
      '<div class="board-comment-form-btns">' +
      '<button type="button" class="board-emoji-toggle" aria-label="Add an emoji" aria-haspopup="true" aria-expanded="false">🤓</button>' +
      '<button type="submit" class="btn btn-ghost">Comment</button>' +
      "</div>" +
      "</div>" +
      renderEmojiPicker() +
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
    var curiousFetch = typeof fetchBoardCuriousCounts === "function"
      ? fetchBoardCuriousCounts()
      : Promise.resolve([]);
    Promise.all([fetchBoardPosts(100), fetchBoardComments(), curiousFetch])
      .then(function (results) {
        var rows = results[0];
        var commentRows = results[1];
        var curiousRows = results[2];
        if (!rows || !rows.length) return; // keep example posts until real ones exist
        var commentsByPost = {};
        (commentRows || []).forEach(function (c) {
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          commentsByPost[c.post_id].push({ id: c.id, name: c.participant_name, body: c.body });
        });
        var curiousByPost = {};
        (curiousRows || []).forEach(function (c) {
          curiousByPost[c.post_id] = c.curious_count;
        });
        posts = rows.map(function (r) {
          return {
            id: r.id,
            name: r.participant_name,
            time: new Date(r.created_at),
            caption: r.caption,
            photoUrl: typeof boardPhotoUrl === "function" ? boardPhotoUrl(r.photo_path) : null,
            curiousCount: curiousByPost[r.id] || 0,
            iAmCurious: false,
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
              curiousCount: 0,
              iAmCurious: false,
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
                curiousCount: 0,
                iAmCurious: false,
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

  // ---- "Beauty!" reactions + comment emoji picker (event delegation —
  // the feed is re-rendered on every post/comment, same reason the
  // comment-form submit listener above is delegated too) -----------------
  function insertAtCursor(textarea, text) {
    var start = textarea.selectionStart != null ? textarea.selectionStart : textarea.value.length;
    var end = textarea.selectionEnd != null ? textarea.selectionEnd : textarea.value.length;
    var value = textarea.value;
    textarea.value = value.slice(0, start) + text + value.slice(end);
    var newPos = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = newPos;
  }

  function closeEmojiPicker(picker) {
    if (!picker) return;
    picker.classList.remove("is-open");
    var form = picker.closest("form");
    var toggleBtn = form && form.querySelector(".board-emoji-toggle");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
  }

  feed.addEventListener("click", function (evt) {
    // Emoji-picker toggle button.
    var emojiToggle = evt.target.closest(".board-emoji-toggle");
    if (emojiToggle) {
      var picker = emojiToggle.closest("form").querySelector(".board-emoji-picker");
      if (picker) {
        var willOpen = !picker.classList.contains("is-open");
        // Close any other open picker first (only one at a time).
        feed.querySelectorAll(".board-emoji-picker.is-open").forEach(closeEmojiPicker);
        if (willOpen) {
          picker.classList.add("is-open");
          emojiToggle.setAttribute("aria-expanded", "true");
        }
      }
      return;
    }

    // A specific emoji, chosen from an open picker.
    var emojiOption = evt.target.closest(".board-emoji-option");
    if (emojiOption) {
      var optForm = emojiOption.closest("form");
      var textarea = optForm && optForm.querySelector('textarea[name="body"]');
      if (textarea) {
        insertAtCursor(textarea, emojiOption.getAttribute("data-emoji") || "");
        textarea.focus();
      }
      closeEmojiPicker(optForm && optForm.querySelector(".board-emoji-picker"));
      return;
    }

    // The "Beauty!" reaction button.
    var curiousBtn = evt.target.closest(".board-curious-btn");
    if (curiousBtn) {
      var postId = curiousBtn.getAttribute("data-post-id");
      var name = (nameField.value || "").trim();
      var pin = (pinField.value || "").trim();

      if (!name) {
        setStatus("Enter your name above to give it a Beauty!");
        return;
      }
      if (!/^[0-9]{4}$/.test(pin)) {
        setStatus("Enter your 4-digit PIN above to give it a Beauty!");
        return;
      }

      curiousBtn.disabled = true;

      var checkStatus = typeof participantStatus === "function"
        ? participantStatus(name)
        : Promise.resolve(null);

      checkStatus
        .catch(function () {
          return "unknown";
        })
        .then(function (status) {
          if (status === null) {
            setStatus('You\'ll need to <a href="register.html">register</a> first — it only takes a minute, then come back and give posts a Beauty! under the same name.');
            curiousBtn.disabled = false;
            return;
          }
          if (status === "banned") {
            setStatus('This name isn\'t able to react here. If you think this is a mistake, email <a href="mailto:contactcuriouslygeorgie@gmail.com">contactcuriouslygeorgie@gmail.com</a>.');
            curiousBtn.disabled = false;
            return;
          }

          var doToggle = typeof hashPin === "function"
            ? hashPin(pin).then(function (pinHash) {
                return typeof toggleBoardCurious === "function"
                  ? toggleBoardCurious(postId, name, pinHash)
                  : Promise.reject(new Error("offline-demo"));
              })
            : Promise.reject(new Error("offline-demo"));

          return doToggle
            .then(function (result) {
              var post = findPost(postId);
              if (post) {
                post.iAmCurious = !!result.is_curious;
                post.curiousCount = result.curious_count || 0;
                renderFeed();
              }
              try { window.localStorage.setItem("cg_participant_name", name); } catch (e) {}
            })
            .catch(function (err) {
              var msg = err && err.message;
              if (msg === "offline-demo") {
                // Backend not configured — still toggle locally so the
                // board feels responsive, same graceful-degradation
                // posture as posting/commenting in demo mode.
                var post = findPost(postId);
                if (post) {
                  post.iAmCurious = !post.iAmCurious;
                  post.curiousCount = Math.max(0, (post.curiousCount || 0) + (post.iAmCurious ? 1 : -1));
                  renderFeed();
                  setNote("Demo mode — this board isn't connected right now, so Beauty! taps here aren't saved anywhere.");
                }
              } else if (msg === "not_registered") {
                setStatus('That name isn\'t registered yet — <a href="register.html">register here</a> first.');
              } else if (msg === "not_active") {
                setStatus('This name isn\'t able to react here. If you think this is a mistake, email <a href="mailto:contactcuriouslygeorgie@gmail.com">contactcuriouslygeorgie@gmail.com</a>.');
              } else if (msg === "invalid_pin") {
                setStatus('<span class="status-warn">That PIN doesn\'t match this name — check it and try again.</span>');
              } else if (msg === "post_not_found") {
                setStatus("That post isn't there anymore.");
              } else {
                setStatus("Couldn't reach the board right now — please try again.");
              }
            })
            .then(function () {
              curiousBtn.disabled = false;
            });
        });
    }
  });

  // Close any open emoji picker on an outside click — same "click away to
  // close" convention as assets/nav.js's dropdowns.
  document.addEventListener("click", function (evt) {
    if (evt.target.closest(".board-comment-form")) return;
    feed.querySelectorAll(".board-emoji-picker.is-open").forEach(closeEmojiPicker);
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

  // ---- "Check my replies" (self-service, no email/push notifications) -
  // The board has no notification system — see
  // supabase/board-replies-check-migration.sql for why — so a
  // participant checks in with the same name + PIN they already use to
  // post and comment, reusing the fields above rather than a separate
  // form.
  var checkRepliesBtn = document.getElementById("board-check-replies");
  var repliesStatusEl = document.getElementById("board-replies-status");
  var repliesResults = document.getElementById("board-replies-results");

  function setRepliesStatus(html) {
    if (!repliesStatusEl) return;
    repliesStatusEl.hidden = !html;
    repliesStatusEl.innerHTML = html || "";
  }

  function renderReplies(rows) {
    if (!repliesResults) return;
    if (!rows.length) {
      repliesResults.innerHTML = '<p class="hint">No new replies since last time you checked.</p>';
      return;
    }
    repliesResults.innerHTML = rows
      .map(function (row) {
        var captionSnippet = (row.post_caption || "").trim();
        if (captionSnippet.length > 60) captionSnippet = captionSnippet.slice(0, 60).trim() + "…";
        return (
          '<div class="board-reply-item">' +
          '<span class="board-reply-context">On your post: “' + escapeHtml(captionSnippet) + '”</span>' +
          '<span class="board-reply-name">' + escapeHtml(row.commenter_name) + "</span>" +
          '<span class="board-reply-body">' + escapeHtml(row.comment_body) + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  if (checkRepliesBtn) {
    checkRepliesBtn.addEventListener("click", function () {
      var name = (nameField.value || "").trim();
      var pin = (pinField.value || "").trim();

      if (!name) {
        setRepliesStatus("Enter your name above first.");
        return;
      }
      if (!/^[0-9]{4}$/.test(pin)) {
        setRepliesStatus("Enter your 4-digit PIN above first.");
        return;
      }

      if (repliesResults) repliesResults.innerHTML = "";
      checkRepliesBtn.disabled = true;
      setRepliesStatus("Checking…");

      if (typeof checkBoardReplies !== "function" || typeof hashPin !== "function") {
        setRepliesStatus("This isn't connected right now — please try again shortly.");
        checkRepliesBtn.disabled = false;
        return;
      }

      hashPin(pin)
        .then(function (pinHash) {
          return checkBoardReplies(name, pinHash);
        })
        .then(function (rows) {
          setRepliesStatus("");
          renderReplies(rows || []);
          try { window.localStorage.setItem("cg_participant_name", name); } catch (e) {}
        })
        .catch(function (err) {
          var msg = err && err.message;
          if (msg === "offline-demo") {
            setRepliesStatus("This isn't connected right now — please try again shortly.");
          } else if (msg === "not_registered") {
            setRepliesStatus('That name isn\'t registered yet — <a href="register.html">register here</a> first.');
          } else if (msg === "invalid_pin") {
            setRepliesStatus('<span class="status-warn">That PIN doesn\'t match this name — check it and try again.</span>');
          } else {
            setRepliesStatus("Couldn't check right now — please try again.");
          }
        })
        .then(function () {
          checkRepliesBtn.disabled = false;
        });
    });
  }
});
