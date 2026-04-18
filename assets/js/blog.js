var POSTS_URL = 'https://33o1s2l689.execute-api.us-east-2.amazonaws.com/posts';

function formatDate(isoString) {
  var d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateParts(isoString) {
  var d = new Date(isoString);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mo: d.toLocaleDateString('en-US', { month: 'short' }).toLowerCase()
  };
}

function estimateReadTime(text) {
  var words = text ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}

function renderContent(content) {
  return content
    .split(/\n\n+/)
    .map(function(para) {
      return '<p>' + para.replace(/\n/g, '<br>') + '</p>';
    })
    .join('');
}

function toggleContent(postId) {
  var body = document.getElementById('post-body-' + postId);
  var btn  = document.getElementById('post-toggle-' + postId);

  if (body.style.display === 'none') {
    body.style.display = 'block';
    btn.textContent = 'Collapse ←';
    btn.style.alignSelf = 'flex-start';
  } else {
    body.style.display = 'none';
    btn.textContent = 'Read →';
    btn.style.alignSelf = '';
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPosts(posts) {
  var container = document.getElementById('blog-posts');

  if (!container) {
    console.error("Missing #blog-posts container");
    return;
  }

  container.innerHTML = ""; // clear existing content

  if (!posts || posts.length === 0) {
    container.innerHTML = "<p>No posts yet.</p>";
    return;
  }

  posts.forEach(function(post) {
    var article = document.createElement('article');
    article.className = 'v2-post-card';

    var safeId = post.post_id.replace(/[^a-zA-Z0-9]/g, '-');
    var dateParts = formatDateParts(post.created_at);
    var tag = post.tag || post.tags || '';
    var readTime = estimateReadTime(post.content);

    article.innerHTML =
      '<div class="v2-post-date-block">' +
        '<span class="v2-post-date-day">' + dateParts.day + '</span>' +
        '<span class="v2-post-date-mo">' + dateParts.mo + '</span>' +
      '</div>' +
      '<div class="v2-post-meta">' +
        '<div class="v2-post-meta-row">' +
          (tag ? '<span class="v2-tag-chip">' + escapeHtml(tag) + '</span>' : '') +
          '<span class="v2-post-readtime">' + readTime + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(post.title) + '</h3>' +
        '<p>' + escapeHtml(post.summary) + '</p>' +
        '<div id="post-body-' + safeId + '" class="v2-post-body" style="display:none;padding-top:12px;">' +
          renderContent(escapeHtml(post.content)) +
        '</div>' +
      '</div>' +
      '<button id="post-toggle-' + safeId + '" class="v2-post-read-btn" onclick="toggleContent(\'' + safeId + '\')">Read →</button>';

    container.appendChild(article);
  });
}

// ✅ Ensure DOM is fully loaded before running
document.addEventListener("DOMContentLoaded", function() {
  console.log("Blog JS loaded");

  fetch(POSTS_URL)
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to load posts');
      return res.json();
    })
    .then(function(posts) {
      console.log("Posts loaded:", posts);
      renderPosts(posts);
    })
    .catch(function(err) {
      console.error("Blog load error:", err);

      var container = document.getElementById('blog-posts');
      if (container) {
        container.innerHTML = "<p>Failed to load posts.</p>";
      }
    });
});