// Announcements Feed page script — reads and renders only. There is no
// composer, no PIN, no comments, no reactions: nobody but George can
// post here (see supabase/announcements-feed-migration.sql and
// claude/community-chat-removal-decision-2026-10-31.md for why this
// replaced the old two-way Curiosity Chat).
(function () {
  "use strict";

  var feedEl = document.getElementById("announcements-feed");
  var emptyEl = document.getElementById("announcements-empty");
  if (!feedEl) return;

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return "";
    }
  }

  function render(rows) {
    feedEl.innerHTML = "";

    if (!rows || rows.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    rows.forEach(function (row) {
      var article = document.createElement("article");
      article.className = "board-post";

      var head = document.createElement("div");
      head.className = "board-post-head";

      var title = document.createElement("span");
      title.className = "board-post-name";
      title.textContent = row.title || "Update from Georgie";

      var time = document.createElement("span");
      time.className = "board-post-time";
      time.textContent = formatDate(row.created_at);

      head.appendChild(title);
      head.appendChild(time);
      article.appendChild(head);

      var photoUrl = typeof announcementPhotoUrl === "function" ? announcementPhotoUrl(row.photo_path) : null;
      if (photoUrl) {
        var photo = document.createElement("img");
        photo.src = photoUrl;
        photo.alt = row.title || "Featured photo";
        photo.loading = "lazy";
        photo.className = "board-post-photo";
        article.appendChild(photo);
      }

      var body = document.createElement("p");
      body.className = "board-post-caption";
      body.textContent = row.body;
      article.appendChild(body);

      feedEl.appendChild(article);
    });
  }

  if (typeof fetchAnnouncements === "function") {
    fetchAnnouncements(50)
      .then(render)
      .catch(function () {
        render([]);
      });
  } else {
    render([]);
  }
})();
