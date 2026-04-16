const API_URL = 'https://33o1s2l689.execute-api.us-east-2.amazonaws.com/subscribe';

document.querySelectorAll('.newsletter-form, .newsletter-form-inline').forEach(function(form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var emailInput = form.querySelector('input[type="email"]');
    var phoneInput = form.querySelector('input[type="tel"]');
    var btn = form.querySelector('button[type="submit"]');

    var email = emailInput ? emailInput.value.trim() : '';
    var phone = phoneInput ? phoneInput.value.trim() : '';

    if (!email) {
      showMessage(form, 'Please enter your email address.', false);
      return;
    }

    btn.disabled = true;
    var originalText = btn.textContent;
    btn.textContent = 'Subscribing…';

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, phone: phone })
    })
      .then(function(res) {
        if (!res.ok) throw new Error('Server error: ' + res.status);
        showMessage(form, "You're subscribed. Talk soon.", true);
        form.reset();
      })
      .catch(function() {
        showMessage(form, 'Something went wrong. Please try again.', false);
        btn.disabled = false;
        btn.textContent = originalText;
      });
  });
});

function showMessage(form, text, success) {
  var existing = form.parentElement.querySelector('.newsletter-msg');
  if (existing) existing.remove();

  var msg = document.createElement('p');
  msg.className = 'newsletter-msg';
  msg.textContent = text;
  msg.style.cssText = 'margin-top:10px;font-size:0.9rem;color:' + (success ? '#4caf50' : '#e53935') + ';';
  form.insertAdjacentElement('afterend', msg);
}
