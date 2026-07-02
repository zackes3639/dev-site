const UNSUBSCRIBE_URL = 'https://33o1s2l689.execute-api.us-east-2.amazonaws.com/unsubscribe';

function setStatus(message, isError) {
  var spinner = document.getElementById('unsub-spinner');
  var icon = document.getElementById('unsub-icon');
  var heading = document.getElementById('unsub-heading');
  var subtext = document.getElementById('unsub-subtext');

  spinner.style.display = 'none';
  icon.style.display = 'flex';

  if (isError) {
    icon.textContent = '✕';
    icon.style.background = '#fee2e2';
    icon.style.color = '#e53935';
    heading.textContent = message;
    subtext.textContent = 'Email support@zacksimon.dev for help.';
  } else {
    icon.textContent = '✓';
    icon.style.background = '#dcfce7';
    icon.style.color = '#16a34a';
    heading.textContent = message;
    subtext.textContent = 'No more Build Log emails from us.';
    document.getElementById('unsub-compliance').style.display = 'block';
  }
}

(function() {
  var params = new URLSearchParams(window.location.search);
  var email = params.get('email');
  var token = params.get('token');

  if (!email || !token) {
    setStatus('Invalid unsubscribe link.', true);
    return;
  }

  document.getElementById('unsub-email').textContent = 'Unsubscribed: ' + email;

  fetch(UNSUBSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, token: token })
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Server error: ' + res.status);
      setStatus('Unsubscribed successfully.', false);
    })
    .catch(function() {
      setStatus('Unsubscribe failed.', true);
    });
})();
