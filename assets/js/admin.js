var POSTS_URL      = 'https://33o1s2l689.execute-api.us-east-2.amazonaws.com/posts';
var CREATE_URL     = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts';
var UPDATE_URL     = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts/update';
var DELETE_URL     = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts/delete';

var sessionPassword = '';
var editingPostId   = null;
var allPosts        = [];

// ── View switching ──────────────────────────────────────────────────────────

function showView(id) {
  ['view-login', 'view-list', 'view-form'].forEach(function(v) {
    document.getElementById(v).style.display = v === id ? 'block' : 'none';
  });
}

function setPageTitle(t) {
  document.getElementById('admin-page-title').textContent = t;
}

// ── Messages ────────────────────────────────────────────────────────────────

function showMsg(elId, text, success) {
  var el = document.getElementById(elId);
  el.textContent = text;
  el.style.color = success ? '#16a34a' : '#e53935';
  el.style.display = 'block';
}

function clearMsg(elId) {
  var el = document.getElementById(elId);
  el.style.display = 'none';
  el.textContent = '';
}

// ── Post list ───────────────────────────────────────────────────────────────

function loadPostList() {
  var body = document.getElementById('post-list-body');
  body.innerHTML = '<p class="admin-empty">Loading…</p>';
  clearMsg('list-msg');

  fetch(POSTS_URL)
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to load posts');
      return res.json();
    })
    .then(function(posts) {
      allPosts = posts;
      renderPostList(posts);
    })
    .catch(function() {
      body.innerHTML = '<p class="admin-empty">Failed to load posts.</p>';
    });
}

function renderPostList(posts) {
  var body = document.getElementById('post-list-body');
  var count = document.getElementById('list-count');
  count.textContent = posts.length + ' Post' + (posts.length !== 1 ? 's' : '');

  if (posts.length === 0) {
    body.innerHTML = '<p class="admin-empty">No posts yet. Create one!</p>';
    return;
  }

  body.innerHTML = '';
  posts.forEach(function(post) {
    var row = document.createElement('div');
    row.className = 'admin-post-row';

    var date = post.created_at
      ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    row.innerHTML =
      '<div class="admin-post-info">' +
        '<div class="admin-post-row-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="admin-post-meta">' + date + (post.slug ? ' · /' + escapeHtml(post.slug) : '') + '</div>' +
      '</div>' +
      '<span class="admin-post-badge ' + (post.published ? 'badge-published' : 'badge-draft') + '">' +
        (post.published ? 'Published' : 'Draft') +
      '</span>' +
      '<div class="admin-row-actions">' +
        '<button class="admin-btn edit-btn" data-id="' + post.post_id + '">Edit</button>' +
        '<button class="admin-btn admin-btn-danger delete-btn" data-id="' + post.post_id + '">Delete</button>' +
      '</div>';

    body.appendChild(row);
  });

  body.querySelectorAll('.edit-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { openEditForm(btn.dataset.id); });
  });
  body.querySelectorAll('.delete-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { deletePost(btn.dataset.id, btn); });
  });
}

// ── Delete ───────────────────────────────────────────────────────────────────

function deletePost(postId, btn) {
  var post = allPosts.find(function(p) { return p.post_id === postId; });
  var title = post ? '"' + post.title + '"' : 'this post';
  if (!confirm('Delete ' + title + '? This cannot be undone.')) return;

  btn.disabled = true;
  btn.textContent = '…';

  fetch(DELETE_URL, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: sessionPassword, post_id: postId })
  })
    .then(function(res) {
      if (res.status === 403) throw new Error('Incorrect password.');
      if (!res.ok) throw new Error('Server error (' + res.status + ').');
      return res.json();
    })
    .then(function() {
      loadPostList();
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = 'Delete';
      showMsg('list-msg', err.message, false);
    });
}

// ── Form (create + edit) ─────────────────────────────────────────────────────

function openNewForm() {
  editingPostId = null;
  document.getElementById('post-form').reset();
  document.getElementById('form-mode-title').textContent = 'New Post';
  document.getElementById('form-submit-btn').textContent = 'Publish Post';
  clearMsg('form-msg');
  setPageTitle('New Post');
  showView('view-form');
}

function openEditForm(postId) {
  var post = allPosts.find(function(p) { return p.post_id === postId; });
  if (!post) return;

  editingPostId = postId;
  document.getElementById('f-title').value     = post.title || '';
  document.getElementById('f-slug').value      = post.slug || '';
  document.getElementById('f-summary').value   = post.summary || '';
  document.getElementById('f-tag').value       = post.tag || post.tags || '';
  document.getElementById('f-content').value   = post.content || '';
  document.getElementById('f-published').checked = !!post.published;
  document.getElementById('form-mode-title').textContent = 'Edit Post';
  document.getElementById('form-submit-btn').textContent = 'Save Changes';
  clearMsg('form-msg');
  setPageTitle('Edit Post');
  showView('view-form');
}

document.getElementById('post-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var btn = document.getElementById('form-submit-btn');

  var title     = document.getElementById('f-title').value.trim();
  var slug      = document.getElementById('f-slug').value.trim();
  var summary   = document.getElementById('f-summary').value.trim();
  var tag       = document.getElementById('f-tag').value.trim();
  var content   = document.getElementById('f-content').value.trim();
  var published = document.getElementById('f-published').checked;

  if (!title)   { showMsg('form-msg', 'Title is required.', false); return; }
  if (!summary) { showMsg('form-msg', 'Summary is required.', false); return; }
  if (!content) { showMsg('form-msg', 'Content is required.', false); return; }

  btn.disabled = true;
  btn.textContent = editingPostId ? 'Saving…' : 'Publishing…';
  clearMsg('form-msg');

  var payload = { password: sessionPassword, title: title, summary: summary, content: content, published: published };
  if (slug) payload.slug = slug;
  if (tag)  payload.tag  = tag;

  var url, method;
  if (editingPostId) {
    url = UPDATE_URL;
    method = 'PUT';
    payload.post_id = editingPostId;
  } else {
    url = CREATE_URL;
    method = 'POST';
  }

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function(res) {
      if (res.status === 403) throw new Error('Incorrect password.');
      if (res.status === 409) throw new Error('That slug already exists. Choose a different one.');
      if (!res.ok) throw new Error('Server error (' + res.status + '). Try again.');
      return res.json();
    })
    .then(function() {
      showMsg('form-msg', editingPostId ? 'Post updated.' : 'Post created.', true);
      btn.disabled = false;
      btn.textContent = editingPostId ? 'Save Changes' : 'Publish Post';
      if (!editingPostId) document.getElementById('post-form').reset();
    })
    .catch(function(err) {
      showMsg('form-msg', err.message || 'Something went wrong.', false);
      btn.disabled = false;
      btn.textContent = editingPostId ? 'Save Changes' : 'Publish Post';
    });
});

// ── Login ────────────────────────────────────────────────────────────────────

document.getElementById('login-btn').addEventListener('click', function() {
  var pw  = document.getElementById('admin-password').value.trim();
  var btn = document.getElementById('login-btn');
  if (!pw) { showMsg('login-msg', 'Enter your admin password.', false); return; }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  clearMsg('login-msg');

  // Validate password by attempting a create with a dummy request that will 403 or pass
  fetch(CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw, _validate: true })
  })
    .then(function(res) {
      if (res.status === 403) throw new Error('Incorrect password.');
      // 400 (missing fields) means auth passed
      sessionPassword = pw;
      setPageTitle('Posts');
      showView('view-list');
      loadPostList();
    })
    .catch(function(err) {
      showMsg('login-msg', err.message, false);
      btn.disabled = false;
      btn.textContent = 'Sign In';
    });
});

document.getElementById('admin-password').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

// ── Nav ──────────────────────────────────────────────────────────────────────

document.getElementById('new-post-btn').addEventListener('click', openNewForm);

document.getElementById('back-btn').addEventListener('click', function() {
  setPageTitle('Posts');
  showView('view-list');
  loadPostList();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ─────────────────────────────────────────────────────────────────────

showView('view-login');
