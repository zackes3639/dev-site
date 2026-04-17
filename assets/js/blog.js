var POSTS_URL = 'https://33o1s2l689.execute-api.us-east-2.amazonaws.com/posts';

function formatDate(isoString) {
  var d = new Date(isoString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
  } else {
    body.style.display = 'none';
    btn.textContent = 'Read →';
  }
}

function renderPosts(posts) {
  var container = document.getElementById('blog-posts');
  if (!container) return;
  if (!posts || posts.length === 0) return;

  posts.forEach(function(post) {
    var article = document.createElement('article');
    article.className = 'post-card';

    var safeId = post.post_id.replace(/[^a-zA-Z0-9]/g, '-');

    article.innerHTML =
      '<div class="post-card-top">' +
        '<div>' +
          '<h2 class="post-title">' + escapeHtml(post.title) + '</h2>' +
          '<p class="post-excerpt">' + escapeHtml(post.summary) + '</p>' +
        '</div>' +
        '<button id="post-toggle-' + safeId + '" class="post-link" onclick="toggleContent(\'' + safeId + '\')">Read →</button>' +
      '</div>' +
      '<div id="post-body-' + safeId + '" class="post-body" style="display:none;padding-top:16px;">' +
        renderContent(escapeHtml(post.content)) +
      '</div>' +
      '<span class="post-date">' + formatDate(post.created_at) + '</span>';

    container.appendChild(article);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

fetch(POSTS_URL)
  .then(function(res) {
    if (!res.ok) throw new Error('Failed to load posts');
    return res.json();
  })
  .then(function(posts) {
    renderPosts(posts);
  })
  .catch(function() {
    // Silent fail — static posts remain visible
  });
