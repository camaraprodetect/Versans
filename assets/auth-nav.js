(function () {
  'use strict';

  function setLink(link, user) {
    var text = link.querySelector('[data-auth-text]');
    link.href = user ? 'account.html' : 'login.html';
    link.setAttribute('aria-label', user ? 'החשבון שלי' : 'התחברות');
    if (text) text.textContent = user ? user.name : 'התחברות';
    link.classList.toggle('is-authenticated', !!user);
  }

  function refresh() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-auth-link]'));
    if (!links.length) return;
    fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { links.forEach(function (link) { setLink(link, data && data.user ? data.user : null); }); })
      .catch(function () { links.forEach(function (link) { setLink(link, null); }); });
  }

  refresh();
})();
