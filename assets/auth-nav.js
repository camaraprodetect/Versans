(function () {
  'use strict';

  function setLink(link, user, guest) {
    var text = link.querySelector('[data-auth-text]');
    var guestName = guest && guest.name ? String(guest.name) : '';
    var label = user && user.name ? String(user.name) : (guestName || 'התחברות');

    /* A guest is still sent to login/account creation when this control is
       clicked, but visually their stable Guest_#### identity is shown exactly
       like the account name would be shown. */
    link.href = user ? '/account' : '/login';
    link.setAttribute('aria-label', user ? 'החשבון שלי' : (guestName ? label : 'התחברות'));
    if (text) text.textContent = label;

    link.classList.toggle('is-authenticated', !!user);
    link.classList.toggle('is-guest', !user && !!guestName);
    if (guest && guest.isVerifiedCustomer) {
      link.setAttribute('data-verified-customer', '1');
    } else {
      link.removeAttribute('data-verified-customer');
    }
  }

  function refresh() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-auth-link]'));
    if (!links.length) return;
    fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var user = data && data.user ? data.user : null;
        var guest = !user && data && data.guest ? data.guest : null;
        links.forEach(function (link) { setLink(link, user, guest); });
      })
      .catch(function () { links.forEach(function (link) { setLink(link, null, null); }); });
  }

  refresh();
})();
