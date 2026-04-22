var CREATE_POST_URL = 'https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts';

document.getElementById('admin-form').addEventListener('submit', function(e) {
  e.preventDefault();

  var password  = document.getElementById('admin-password').value.trim();
  var title     = document.getElementById('post-title').value.trim();
  var slug      = document.getElementById('post-slug').value.trim();
  var summary   = document.getElementById('post-summary').value.trim();
  var content   = document.getElementById('post-content').value.trim();
  var published = document.getElementById('post-published').checked;
  var btn       = document.getElementById('admin-submit');

  if (!password) { showMsg('Enter your admin password.', false); return; }
  if (!title)    { showMsg('Title is required.', false); return; }
  if (!summary)  { showMsg('Summary is required.', false); return; }
  if (!content)  { showMsg('Content is required.', false); return; }

  btn.disabled = true;
  btn.textContent = 'Publishing…';

  var payload = { password: password, title: title, summary: summary, content: content, published: published };
  if (slug) payload.slug = slug;

  fetch(CREATE_POST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function(res) {
      if (res.status === 403) throw new Error('Incorrect password.');
      if (res.status === 409) throw new Error('That slug already exists. Choose a different one.');
      if (!res.ok) throw new Error('Server error (' + res.status + '). Try again.');
      return res.json();
    })
    .then(function(data) {
      showMsg('Post Successfully Created', true);
      document.getElementById('admin-form').reset();
      btn.disabled = false;
      btn.textContent = 'Publish Post';
    })
    .catch(function(err) {
      showMsg(err.message || 'Something went wrong.', false);
      btn.disabled = false;
      btn.textContent = 'Publish Post';
    });
});

function showMsg(text, success) {
  var msg = document.getElementById('admin-msg');
  msg.textContent = text;
  msg.style.color = success ? '#16a34a' : '#e53935';
  msg.style.display = 'block';
}
