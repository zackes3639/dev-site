var POSTS_URL      = 'https://33o1s2l689.execute-api.us-east-2.amazonaws.com/posts';
var CREATE_URL     = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts';
var UPDATE_URL     = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts/update';
var DELETE_URL     = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts/delete';

var BUILDS_GET_URL    = 'https://33o1s2l689.execute-api.us-east-2.amazonaws.com/builds';
var BUILDS_CREATE_URL = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/builds';
var BUILDS_UPDATE_URL = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/builds/update';
var BUILDS_DELETE_URL = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/builds/delete';

var sessionPassword = '';
var editingPostId   = null;
var editingBuildId  = null;
var allPosts        = [];
var allBuilds       = [];

// ── View switching ──────────────────────────────────────────────────────────

var ALL_VIEWS = ['view-login', 'view-hub', 'view-list', 'view-form', 'view-builds-list', 'view-builds-form'];

function showView(id) {
  ALL_VIEWS.forEach(function(v) {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Login ────────────────────────────────────────────────────────────────────

document.getElementById('login-btn').addEventListener('click', function() {
  var pw  = document.getElementById('admin-password').value.trim();
  var btn = document.getElementById('login-btn');
  if (!pw) { showMsg('login-msg', 'Enter your admin password.', false); return; }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  clearMsg('login-msg');

  fetch(CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw, _validate: true })
  })
    .then(function(res) {
      if (res.status === 403) throw new Error('Incorrect password.');
      sessionPassword = pw;
      setPageTitle('Admin');
      showView('view-hub');
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

// ── Hub ──────────────────────────────────────────────────────────────────────

document.getElementById('hub-blog-btn').addEventListener('click', function() {
  setPageTitle('The Build Log');
  showView('view-list');
  loadPostList();
});

document.getElementById('hub-builds-btn').addEventListener('click', function() {
  setPageTitle('Builds');
  showView('view-builds-list');
  loadBuildList();
});

document.getElementById('blog-back-to-hub-btn').addEventListener('click', function() {
  setPageTitle('Admin');
  showView('view-hub');
});

// ── Post list ───────────────────────────────────────────────────────────────

function loadPostList() {
  var body = document.getElementById('post-list-body');
  body.innerHTML = '<p class="admin-empty">Loading…</p>';
  clearMsg('list-msg');

  var listUrl = POSTS_URL + '?include_drafts=1&password=' + encodeURIComponent(sessionPassword);

  fetch(listUrl)
    .then(function(res) {
      if (res.status === 403) throw new Error('Session expired or password is incorrect. Please sign in again.');
      if (!res.ok) throw new Error('Failed to load posts');
      return res.json();
    })
    .then(function(posts) {
      allPosts = posts;
      renderPostList(posts);
    })
    .catch(function(err) {
      if (err && /sign in again/i.test(err.message)) {
        sessionPassword = '';
        setPageTitle('Sign In');
        showView('view-login');
        showMsg('login-msg', err.message, false);
        return;
      }
      body.innerHTML = '<p class="admin-empty">Failed to load posts.</p>';
    });
}

function renderPostList(posts) {
  var body  = document.getElementById('post-list-body');
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

// ── Post delete ───────────────────────────────────────────────────────────────

function deletePost(postId, btn) {
  var post  = allPosts.find(function(p) { return p.post_id === postId; });
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
    .then(function() { loadPostList(); })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = 'Delete';
      showMsg('list-msg', err.message, false);
    });
}

// ── Post form (create + edit) ─────────────────────────────────────────────────

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
  document.getElementById('f-title').value       = post.title || '';
  document.getElementById('f-slug').value        = post.slug || '';
  document.getElementById('f-summary').value     = post.summary || '';
  document.getElementById('f-tag').value         = post.tag || post.tags || '';
  document.getElementById('f-content').value     = post.content || '';
  document.getElementById('f-published').checked = !!post.published;
  document.getElementById('form-mode-title').textContent  = 'Edit Post';
  document.getElementById('form-submit-btn').textContent  = 'Save Changes';
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
    url = UPDATE_URL; method = 'PUT'; payload.post_id = editingPostId;
  } else {
    url = CREATE_URL; method = 'POST';
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

document.getElementById('new-post-btn').addEventListener('click', openNewForm);

document.getElementById('back-btn').addEventListener('click', function() {
  setPageTitle('The Build Log');
  showView('view-list');
  loadPostList();
});

// ── Build list ────────────────────────────────────────────────────────────────

function loadBuildList() {
  var body = document.getElementById('builds-list-body');
  body.innerHTML = '<p class="admin-empty">Loading…</p>';
  clearMsg('builds-list-msg');

  fetch(BUILDS_GET_URL)
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to load builds');
      return res.json();
    })
    .then(function(builds) {
      allBuilds = builds;
      renderBuildList(builds);
    })
    .catch(function() {
      body.innerHTML = '<p class="admin-empty">Failed to load builds. Check that the API URL is configured.</p>';
    });
}

function renderBuildList(builds) {
  var body  = document.getElementById('builds-list-body');
  var count = document.getElementById('builds-list-count');
  count.textContent = builds.length + ' Build' + (builds.length !== 1 ? 's' : '');

  if (builds.length === 0) {
    body.innerHTML = '<p class="admin-empty">No builds yet. Create one!</p>';
    return;
  }

  var statusLabel = { live: 'Live', wip: 'In Progress', idea: 'Idea' };
  var statusClass = { live: 'badge-live', wip: 'badge-wip', idea: 'badge-idea' };

  body.innerHTML = '';
  builds.forEach(function(build) {
    var row = document.createElement('div');
    row.className = 'admin-post-row';

    var label = statusLabel[build.status] || build.status;
    var cls   = statusClass[build.status] || 'badge-draft';
    var meta  = build.tags && build.tags.length ? build.tags.join(', ') : '';

    row.innerHTML =
      '<div class="admin-post-info">' +
        '<div class="admin-post-row-title">' + escapeHtml(build.title) + '</div>' +
        (meta ? '<div class="admin-post-meta">' + escapeHtml(meta) + '</div>' : '') +
      '</div>' +
      '<span class="admin-post-badge ' + cls + '">' + label + '</span>' +
      '<div class="admin-row-actions">' +
        '<button class="admin-btn edit-build-btn" data-id="' + build.build_id + '">Edit</button>' +
        '<button class="admin-btn admin-btn-danger delete-build-btn" data-id="' + build.build_id + '">Delete</button>' +
      '</div>';

    body.appendChild(row);
  });

  body.querySelectorAll('.edit-build-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { openEditBuildForm(btn.dataset.id); });
  });
  body.querySelectorAll('.delete-build-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { deleteBuild(btn.dataset.id, btn); });
  });
}

// ── Build delete ──────────────────────────────────────────────────────────────

function deleteBuild(buildId, btn) {
  var build = allBuilds.find(function(b) { return b.build_id === buildId; });
  var title = build ? '"' + build.title + '"' : 'this build';
  if (!confirm('Delete ' + title + '? This cannot be undone.')) return;

  btn.disabled = true;
  btn.textContent = '…';

  fetch(BUILDS_DELETE_URL, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: sessionPassword, build_id: buildId })
  })
    .then(function(res) {
      if (res.status === 403) throw new Error('Incorrect password.');
      if (!res.ok) throw new Error('Server error (' + res.status + ').');
      return res.json();
    })
    .then(function() { loadBuildList(); })
    .catch(function(err) {
      btn.disabled = false;
      btn.textContent = 'Delete';
      showMsg('builds-list-msg', err.message, false);
    });
}

// ── Build form (create + edit) ────────────────────────────────────────────────

function syncProgressField() {
  var status = document.getElementById('b-status').value;
  document.getElementById('b-progress-field').style.display = status === 'wip' ? 'flex' : 'none';
}

document.getElementById('b-status').addEventListener('change', syncProgressField);

function openNewBuildForm() {
  editingBuildId = null;
  document.getElementById('builds-form').reset();
  document.getElementById('b-sort').value = '0';
  document.getElementById('builds-form-mode-title').textContent = 'New Build';
  document.getElementById('builds-form-submit-btn').textContent = 'Save Build';
  syncProgressField();
  clearMsg('builds-form-msg');
  setPageTitle('New Build');
  showView('view-builds-form');
}

function openEditBuildForm(buildId) {
  var build = allBuilds.find(function(b) { return b.build_id === buildId; });
  if (!build) return;

  editingBuildId = buildId;
  document.getElementById('b-title').value       = build.title || '';
  document.getElementById('b-description').value = build.description || '';
  document.getElementById('b-status').value      = build.status || 'idea';
  document.getElementById('b-progress').value    = build.progress || '';
  document.getElementById('b-tags').value        = (build.tags || []).join(', ');
  document.getElementById('b-link').value        = build.link || '';
  document.getElementById('b-sort').value        = build.sort_order != null ? build.sort_order : '0';
  document.getElementById('b-dim').checked       = !!build.dim;
  document.getElementById('builds-form-mode-title').textContent = 'Edit Build';
  document.getElementById('builds-form-submit-btn').textContent = 'Save Changes';
  syncProgressField();
  clearMsg('builds-form-msg');
  setPageTitle('Edit Build');
  showView('view-builds-form');
}

document.getElementById('builds-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var btn = document.getElementById('builds-form-submit-btn');

  var title       = document.getElementById('b-title').value.trim();
  var description = document.getElementById('b-description').value.trim();
  var status      = document.getElementById('b-status').value;
  var progressVal = document.getElementById('b-progress').value.trim();
  var tagsRaw     = document.getElementById('b-tags').value.trim();
  var link        = document.getElementById('b-link').value.trim();
  var sortOrder   = document.getElementById('b-sort').value.trim();
  var dim         = document.getElementById('b-dim').checked;

  if (!title) { showMsg('builds-form-msg', 'Title is required.', false); return; }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  clearMsg('builds-form-msg');

  var tags = tagsRaw ? tagsRaw.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];

  var payload = {
    password:    sessionPassword,
    title:       title,
    description: description,
    status:      status,
    tags:        tags,
    link:        link,
    progress:    progressVal ? parseInt(progressVal, 10) : 0,
    dim:         dim,
    sort_order:  sortOrder ? parseInt(sortOrder, 10) : 0
  };

  var url, method;
  if (editingBuildId) {
    url = BUILDS_UPDATE_URL; method = 'PUT'; payload.build_id = editingBuildId;
  } else {
    url = BUILDS_CREATE_URL; method = 'POST';
  }

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function(res) {
      if (res.status === 403) throw new Error('Incorrect password.');
      if (!res.ok) throw new Error('Server error (' + res.status + ').');
      return res.json();
    })
    .then(function() {
      showMsg('builds-form-msg', editingBuildId ? 'Build updated.' : 'Build created.', true);
      btn.disabled = false;
      btn.textContent = editingBuildId ? 'Save Changes' : 'Save Build';
      if (!editingBuildId) {
        document.getElementById('builds-form').reset();
        document.getElementById('b-sort').value = '0';
        syncProgressField();
      }
    })
    .catch(function(err) {
      showMsg('builds-form-msg', err.message || 'Something went wrong.', false);
      btn.disabled = false;
      btn.textContent = editingBuildId ? 'Save Changes' : 'Save Build';
    });
});

document.getElementById('new-build-btn').addEventListener('click', openNewBuildForm);

document.getElementById('builds-back-to-hub-btn').addEventListener('click', function() {
  setPageTitle('Admin');
  showView('view-hub');
});

document.getElementById('builds-back-btn').addEventListener('click', function() {
  setPageTitle('Builds');
  showView('view-builds-list');
  loadBuildList();
});

// ── Init ─────────────────────────────────────────────────────────────────────

showView('view-login');
