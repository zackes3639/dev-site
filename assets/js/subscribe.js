const API_URL = 'https://33o1s2l689.execute-api.us-east-2.amazonaws.com/subscribe';

document.querySelectorAll('select[name="age"]').forEach(function(sel) {
  for (var i = 1; i <= 99; i++) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    sel.appendChild(opt);
  }
});

document.querySelectorAll('input[type="tel"]').forEach(function(input) {
  input.addEventListener('input', function(e) {
    var digits = input.value.replace(/\D/g, '').slice(0, 10);
    var formatted = '';
    if (digits.length === 0) {
      formatted = '';
    } else if (digits.length <= 3) {
      formatted = '(' + digits;
    } else if (digits.length <= 6) {
      formatted = '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
    } else {
      formatted = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
    }
    input.value = formatted;
  });
});

document.querySelectorAll('.newsletter-form, .newsletter-form-inline').forEach(function(form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var emailInput = form.querySelector('input[type="email"]');
    var phoneInput = form.querySelector('input[type="tel"]');
    var ageSelect = form.querySelector('select[name="age"]');
    var btn = form.querySelector('button[type="submit"]');

    var email = emailInput ? emailInput.value.trim() : '';
    var phone = phoneInput ? phoneInput.value.trim() : '';
    var age = ageSelect ? ageSelect.value : '';

    if (!email) {
      showMessage(form, 'Please enter your email address.', false);
      return;
    }

    var consentCheck = form.querySelector('.newsletter-consent-check');
    if (consentCheck && !consentCheck.checked) {
      showMessage(form, 'Please agree to the Privacy Policy & Terms to subscribe.', false);
      return;
    }

    btn.disabled = true;
    var originalText = btn.textContent;
    btn.textContent = 'Subscribing…';

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, phone: phone, age: age })
    })
      .then(function(res) {
        if (!res.ok) throw new Error('Server error: ' + res.status);
        showMessage(form, "You're subscribed. Talk soon.", true);
        form.reset();
        btn.disabled = false;
        btn.textContent = originalText;
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
