(function () {
  'use strict';

  var strings = {
    he: {
      loginTitle: 'כניסה לחשבון', loginLead: 'התחברו כדי לנהל את החשבון שלכם ב־VerSans.',
      registerTitle: 'יצירת חשבון', registerLead: 'כמה שניות ואתם בפנים. הפרטים נשמרים באופן מאובטח.',
      email: 'אימייל', password: 'סיסמה', name: 'שם מלא', confirm: 'אימות סיסמה',
      login: 'התחברות', register: 'יצירת חשבון', show: 'הצג', hide: 'הסתר',
      invalidCredentials: 'האימייל או הסיסמה אינם נכונים.', invalidEmail: 'יש להזין כתובת אימייל תקינה.',
      invalidName: 'יש להזין שם של לפחות 2 תווים.', invalidPassword: 'הסיסמה חייבת להכיל לפחות 8 תווים.',
      mismatch: 'הסיסמאות אינן תואמות.', exists: 'כבר קיים חשבון עם האימייל הזה.', tooMany: 'בוצעו יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
      generic: 'משהו השתבש. נסו שוב.', loading: 'רק רגע…', accountTitle: 'החשבון שלי', accountLead: 'פרטי החשבון המחובר כרגע.',
      logout: 'התנתקות', shop: 'חזרה לחנות', memberSince: 'נרשמת בתאריך', accountEmail: 'אימייל', accountName: 'שם',
      visualTitle: 'המתנה שלכם. החשבון שלכם.', visualText: 'חשבון VerSans מאפשר לנו לזהות אתכם בצורה מאובטחת ולהוסיף בהמשך היסטוריית הזמנות, ביקורות והטבות.',
      newHere: 'עדיין אין לכם חשבון?', createNow: 'צרו חשבון', already: 'כבר רשומים?', loginNow: 'התחברו', back: 'חזרה לחנות', passHint: 'לפחות 8 תווים.'
    },
    en: {
      loginTitle: 'Sign in', loginLead: 'Sign in to manage your VerSans account.', registerTitle: 'Create account', registerLead: 'A few seconds and you are in. Your details are stored securely.',
      email: 'Email', password: 'Password', name: 'Full name', confirm: 'Confirm password', login: 'Sign in', register: 'Create account', show: 'Show', hide: 'Hide',
      invalidCredentials: 'The email or password is incorrect.', invalidEmail: 'Enter a valid email address.', invalidName: 'Enter a name with at least 2 characters.', invalidPassword: 'Password must be at least 8 characters.', mismatch: 'Passwords do not match.', exists: 'An account with this email already exists.', tooMany: 'Too many attempts. Try again later.', generic: 'Something went wrong. Try again.', loading: 'Please wait…',
      accountTitle: 'My account', accountLead: 'Details for the account currently signed in.', logout: 'Log out', shop: 'Back to shop', memberSince: 'Member since', accountEmail: 'Email', accountName: 'Name',
      visualTitle: 'Your gift. Your account.', visualText: 'A VerSans account securely identifies you and gives us a foundation for order history, reviews and benefits later on.',
      newHere: 'New here?', createNow: 'Create an account', already: 'Already registered?', loginNow: 'Sign in', back: 'Back to shop', passHint: 'At least 8 characters.'
    }
  };

  var lang = 'he';

  function t(key) { return strings[lang][key] || strings.he[key] || key; }
  function qs(sel) { return document.querySelector(sel); }
  function setText(sel, key) { var el = qs(sel); if (el) el.textContent = t(key); }

  function applyLanguage() {
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    var page = document.body.getAttribute('data-auth-page');
    setText('#authVisualTitle', 'visualTitle'); setText('#authVisualText', 'visualText'); setText('#authBack', 'back');
    if (page === 'login') {
      setText('#authTitle', 'loginTitle'); setText('#authLead', 'loginLead'); setText('[for="email"]', 'email'); setText('[for="password"]', 'password'); setText('#authSubmitText', 'login');
      setText('#switchPrefix', 'newHere'); setText('#switchLink', 'createNow');
      document.title = 'VerSans';
    } else if (page === 'register') {
      setText('#authTitle', 'registerTitle'); setText('#authLead', 'registerLead'); setText('[for="name"]', 'name'); setText('[for="email"]', 'email'); setText('[for="password"]', 'password'); setText('[for="confirmPassword"]', 'confirm'); setText('#passwordHint', 'passHint'); setText('#authSubmitText', 'register');
      setText('#switchPrefix', 'already'); setText('#switchLink', 'loginNow');
      document.title = 'VerSans';
    } else if (page === 'account') {
      setText('#authTitle', 'accountTitle'); setText('#authLead', 'accountLead'); setText('#labelName', 'accountName'); setText('#labelEmail', 'accountEmail'); setText('#labelSince', 'memberSince'); setText('#logoutText', 'logout'); setText('#shopText', 'shop');
      document.title = 'VerSans';
    }
    var langBtn = qs('#authLangBtn'); if (langBtn) langBtn.textContent = lang === 'he' ? 'English' : 'עברית';
    Array.prototype.forEach.call(document.querySelectorAll('[data-password-toggle]'), function (btn) { btn.textContent = t('show'); });
  }

  function setMessage(message, ok) {
    var el = qs('#authMessage'); if (!el) return;
    el.textContent = message || '';
    el.className = 'auth-message' + (message ? (ok ? ' is-ok' : ' is-error') : '');
  }

  function errorText(code) {
    return ({ invalid_credentials: t('invalidCredentials'), invalid_email: t('invalidEmail'), invalid_name: t('invalidName'), invalid_password: t('invalidPassword'), email_exists: t('exists'), too_many_attempts: t('tooMany') })[code] || t('generic');
  }

  function safeNext() {
    var next = new URLSearchParams(location.search).get('next') || '/account';
    if (!/^[A-Za-z0-9_./#?=&%-]+$/.test(next) || next.indexOf('//') !== -1) return '/account';
    if (next.charAt(0) !== '/') next = '/' + next.replace(/^\.?\//, '');
    return next;
  }

  function post(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) { return { response: response, data: data }; }); });
  }

  function checkAlreadyLoggedIn() {
    var page = document.body.getAttribute('data-auth-page');
    if (page !== 'login' && page !== 'register') return;
    fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) { if (data && data.user) location.replace('/account'); }).catch(function () {});
  }

  function bindForm() {
    var form = qs('#authForm'); if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault(); setMessage('');
      var page = document.body.getAttribute('data-auth-page');
      var submit = qs('#authSubmit'); var submitText = qs('#authSubmitText');
      var email = String((qs('#email') || {}).value || '').trim();
      var password = String((qs('#password') || {}).value || '');
      var body = { email: email, password: password };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage(t('invalidEmail')); return; }
      if (password.length < 8) { setMessage(t('invalidPassword')); return; }
      if (page === 'register') {
        body.name = String((qs('#name') || {}).value || '').replace(/\s+/g, ' ').trim();
        if (body.name.length < 2) { setMessage(t('invalidName')); return; }
        if (password !== String((qs('#confirmPassword') || {}).value || '')) { setMessage(t('mismatch')); return; }
      }
      submit.disabled = true; submit.classList.add('is-loading'); submitText.textContent = t('loading');
      post(page === 'register' ? '/api/auth/register' : '/api/auth/login', body).then(function (result) {
        if (!result.response.ok || !result.data.ok) throw result.data;
        location.replace(safeNext());
      }).catch(function (err) {
        setMessage(errorText(err && err.error)); submit.disabled = false; submit.classList.remove('is-loading'); submitText.textContent = t(page === 'register' ? 'register' : 'login');
      });
    });
  }

  function bindPasswordToggles() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-password-toggle]'), function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-password-toggle'));
        if (!input) return;
        var show = input.type === 'password'; input.type = show ? 'text' : 'password'; btn.textContent = t(show ? 'hide' : 'show');
      });
    });
  }

  function loadAccount() {
    if (document.body.getAttribute('data-auth-page') !== 'account') return;
    fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        if (!data.user) { location.replace('/login?next=%2Faccount'); return; }
        qs('#accountLoading').hidden = true; qs('#accountDetails').hidden = false;
        qs('#accountName').textContent = data.user.name; qs('#accountEmail').textContent = data.user.email;
        var d = new Date(data.user.createdAt); qs('#accountSince').textContent = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { dateStyle: 'medium' }).format(d);
      }).catch(function () { location.replace('/login?next=%2Faccount'); });
    var logout = qs('#logoutBtn'); if (logout) logout.addEventListener('click', function () {
      logout.disabled = true; post('/api/auth/logout', {}).then(function () { location.replace('index.html'); }).catch(function () { logout.disabled = false; setMessage(t('generic')); });
    });
  }

  applyLanguage(); bindForm(); bindPasswordToggles(); checkAlreadyLoggedIn(); loadAccount();
})();
