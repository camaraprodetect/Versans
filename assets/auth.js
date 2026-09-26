(function () {
  'use strict';

  var strings = {
    he: {
      loginTitle: 'כניסה לחשבון', loginLead: 'התחברו כדי לנהל את החשבון שלכם ב־VerSans.',
      registerTitle: 'יצירת חשבון', registerLead: 'כמה שניות ואתם בפנים. הפרטים נשמרים באופן מאובטח.',
      forgotTitle: 'שכחתם סיסמה?', forgotLead: 'הזינו את האימייל של החשבון ונשלח לכם קישור מאובטח לבחירת סיסמה חדשה.',
      resetTitle: 'בחירת סיסמה חדשה', resetLead: 'בחרו סיסמה חדשה לחשבון VerSans שלכם.',
      email: 'אימייל', phone: 'מספר טלפון', password: 'סיסמה', newPassword: 'סיסמה חדשה', name: 'שם מלא', confirm: 'אימות סיסמה', confirmNew: 'אימות סיסמה חדשה',
      login: 'התחברות', register: 'יצירת חשבון', sendReset: 'שליחת קישור לאיפוס הסיסמה', savePassword: 'שינוי סיסמה', show: 'הצג', hide: 'הסתר',
      forgotPassword: 'שכחתי סיסמה',
      invalidCredentials: 'האימייל או הסיסמה אינם נכונים.', invalidEmail: 'יש להזין כתובת אימייל תקינה.', invalidPhone: 'יש להזין מספר טלפון תקין.', termsRequired: 'כדי ליצור חשבון צריך לאשר את תנאי השימוש ומדיניות הפרטיות.',
      invalidName: 'יש להזין שם של לפחות 2 תווים.', invalidPassword: 'הסיסמה חייבת להכיל לפחות 8 תווים.',
      invalidReset: 'הקישור לאיפוס הסיסמה אינו תקף או שפג תוקפו. בקשו קישור חדש.',
      resetSent: 'שלחנו קישור לאיפוס הסיסמה למייל. פתחו את ההודעה ולחצו על הקישור כדי לבחור סיסמה חדשה.',
      passwordChanged: 'הסיסמה שונתה בהצלחה. מעבירים אתכם לעמוד ההתחברות…',
      passwordChangedLogin: 'הסיסמה שונתה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.',
      mismatch: 'הסיסמאות אינן תואמות.', exists: 'כבר קיים חשבון עם האימייל הזה.', tooMany: 'בוצעו יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
      generic: 'משהו השתבש. נסו שוב.', loading: 'רק רגע…', accountTitle: 'החשבון שלי', accountLead: 'פרטי החשבון המחובר כרגע.',
      logout: 'התנתקות', shop: 'חזרה לחנות', memberSince: 'נרשמת בתאריך', accountEmail: 'אימייל', accountPhone: 'טלפון', accountName: 'שם',
      visualTitle: 'המתנה שלכם. החשבון שלכם.', visualText: 'חשבון VerSans מאפשר לנהל פרטים, הזמנות, ביקורות והעדפות בצורה מאובטחת.',
      newHere: 'עדיין אין לכם חשבון?', createNow: 'צרו חשבון', already: 'כבר רשומים?', loginNow: 'התחברו', back: 'חזרה לחנות', backToLogin: 'חזרה להתחברות', passHint: 'לפחות 8 תווים.'
    },
    en: {
      loginTitle: 'Sign in', loginLead: 'Sign in to manage your VerSans account.', registerTitle: 'Create account', registerLead: 'A few seconds and you are in. Your details are stored securely.',
      forgotTitle: 'Forgot your password?', forgotLead: 'Enter the email for your account and we will send you a secure reset link.', resetTitle: 'Choose a new password', resetLead: 'Choose a new password for your VerSans account.',
      email: 'Email', phone: 'Phone number', password: 'Password', newPassword: 'New password', name: 'Full name', confirm: 'Confirm password', confirmNew: 'Confirm new password', login: 'Sign in', register: 'Create account', sendReset: 'Send reset link', savePassword: 'Save new password', show: 'Show', hide: 'Hide', forgotPassword: 'Forgot password',
      invalidCredentials: 'The email or password is incorrect.', invalidEmail: 'Enter a valid email address.', invalidPhone: 'Enter a valid phone number.', termsRequired: 'You must accept the Terms of Service and Privacy Policy to create an account.', invalidName: 'Enter a name with at least 2 characters.', invalidPassword: 'Password must be at least 8 characters.', invalidReset: 'This password reset link is invalid or has expired. Request a new one.', resetSent: 'If an account exists for this email, we sent it a password reset link. Check your spam folder too.', passwordChanged: 'Password changed successfully. Redirecting you to sign in…', passwordChangedLogin: 'Password changed successfully. You can now sign in with your new password.', mismatch: 'Passwords do not match.', exists: 'An account with this email already exists.', tooMany: 'Too many attempts. Try again later.', generic: 'Something went wrong. Try again.', loading: 'Please wait…',
      accountTitle: 'My account', accountLead: 'Details for the account currently signed in.', logout: 'Log out', shop: 'Back to shop', memberSince: 'Member since', accountEmail: 'Email', accountPhone: 'Phone', accountName: 'Name',
      visualTitle: 'Your gift. Your account.', visualText: 'A VerSans account lets you securely manage details, orders, reviews and preferences.',
      newHere: 'New here?', createNow: 'Create an account', already: 'Already registered?', loginNow: 'Sign in', back: 'Back to shop', backToLogin: 'Back to sign in', passHint: 'At least 8 characters.'
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
      setText('#authTitle', 'loginTitle'); setText('#authLead', 'loginLead'); setText('[for="email"]', 'email'); setText('[for="password"]', 'password'); setText('#authSubmitText', 'login'); setText('#forgotPasswordLink', 'forgotPassword');
      setText('#switchPrefix', 'newHere'); setText('#switchLink', 'createNow');
    } else if (page === 'register') {
      setText('#authTitle', 'registerTitle'); setText('#authLead', 'registerLead'); setText('[for="name"]', 'name'); setText('[for="email"]', 'email'); setText('[for="phone"]', 'phone'); setText('[for="password"]', 'password'); setText('[for="confirmPassword"]', 'confirm'); setText('#passwordHint', 'passHint'); setText('#authSubmitText', 'register');
      setText('#switchPrefix', 'already'); setText('#switchLink', 'loginNow');
    } else if (page === 'forgot-password') {
      setText('#authTitle', 'forgotTitle'); setText('#authLead', 'forgotLead'); setText('[for="email"]', 'email'); setText('#authSubmitText', 'sendReset'); setText('#switchLink', 'backToLogin');
    } else if (page === 'reset-password') {
      setText('#authTitle', 'resetTitle'); setText('#authLead', 'resetLead'); setText('[for="password"]', 'newPassword'); setText('[for="confirmPassword"]', 'confirmNew'); setText('#passwordHint', 'passHint'); setText('#authSubmitText', 'savePassword'); setText('#switchLink', 'backToLogin');
    } else if (page === 'account') {
      setText('#authTitle', 'accountTitle'); setText('#authLead', 'accountLead'); setText('#labelName', 'accountName'); setText('#labelEmail', 'accountEmail'); setText('#labelPhone', 'accountPhone'); setText('#labelSince', 'memberSince'); setText('#logoutText', 'logout'); setText('#shopText', 'shop');
    }
    document.title = 'VerSans';
    Array.prototype.forEach.call(document.querySelectorAll('[data-password-toggle]'), function (btn) { btn.textContent = t('show'); });
  }

  function setMessage(message, ok) {
    var el = qs('#authMessage'); if (!el) return;
    el.textContent = message || '';
    el.className = 'auth-message' + (message ? (ok ? ' is-ok' : ' is-error') : '');
  }

  function errorText(code) {
    return ({
      invalid_credentials: t('invalidCredentials'), invalid_email: t('invalidEmail'), invalid_phone: t('invalidPhone'), invalid_name: t('invalidName'), invalid_password: t('invalidPassword'),
      invalid_or_expired_reset: t('invalidReset'), terms_required: t('termsRequired'), email_exists: t('exists'), too_many_attempts: t('tooMany'),
      email_not_found: 'לא נמצא חשבון עם כתובת האימייל הזו.',
      email_unavailable: 'לא ניתן לשלוח כרגע מייל לאיפוס הסיסמה. נסו שוב בעוד כמה דקות.',
      email_send_failed: 'שליחת המייל נכשלה. נסו שוב בעוד כמה דקות.',
      account_blocked: 'הגישה לחשבון נחסמה. אפשר לפנות לשירות הלקוחות.',
      reauth_failed: 'הסיסמה לאימות אינה נכונה.'
    })[code] || t('generic');
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

  function api(url, method, body) {
    var options = { method: method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body || {}); }
    return fetch(url, options).then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) { return { response: response, data: data }; }); });
  }

  function formatPhone(phone) {
    phone = String(phone || '').trim();
    if (lang === 'he' && /^\+972\d{9}$/.test(phone)) phone = '0' + phone.slice(4);
    if (/^05\d{8}$/.test(phone)) return phone.slice(0, 3) + '-' + phone.slice(3, 6) + '-' + phone.slice(6);
    return phone;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]; });
  }

  function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

  function setSubmitLoading(submit, submitText, loading, labelKey) {
    if (!submit || !submitText) return;
    submit.disabled = !!loading;
    submit.classList.toggle('is-loading', !!loading);
    submitText.textContent = t(loading ? 'loading' : labelKey);
  }

  function checkAlreadyLoggedIn() {
    var page = document.body.getAttribute('data-auth-page');
    if (page !== 'login' && page !== 'register') return;
    fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) { if (data && data.user) location.replace('/account'); }).catch(function () {});
  }

  function prepareResetPage() {
    if (document.body.getAttribute('data-auth-page') !== 'reset-password') return;
    var submit = qs('#authSubmit');
    if (submit) submit.disabled = true;
    fetch('/api/auth/reset-password/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) { return { response: response, data: data }; }); })
      .then(function (result) {
        if (!result.response.ok || !result.data.ok) throw result.data;
        if (submit) submit.disabled = false;
      })
      .catch(function () {
        setMessage(t('invalidReset'));
        if (submit) submit.disabled = true;
      });
  }

  function showLoginQueryMessage() {
    if (document.body.getAttribute('data-auth-page') !== 'login') return;
    if (new URLSearchParams(location.search).get('reset') === '1') setMessage(t('passwordChangedLogin'), true);
  }

  function bindForm() {
    var form = qs('#authForm'); if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault(); setMessage('');
      var page = document.body.getAttribute('data-auth-page');
      var submit = qs('#authSubmit'); var submitText = qs('#authSubmitText');

      if (page === 'forgot-password') {
        var forgotEmail = String((qs('#email') || {}).value || '').trim();
        if (!validEmail(forgotEmail)) { setMessage(t('invalidEmail')); return; }
        setSubmitLoading(submit, submitText, true, 'sendReset');
        post('/api/auth/forgot-password', { email: forgotEmail }).then(function (result) {
          if (!result.response.ok || !result.data.ok) throw result.data;
          setMessage('שלחנו קישור לאיפוס הסיסמה אל ' + forgotEmail + '. פתחו את המייל ולחצו על הקישור כדי לעבור לעמוד שינוי הסיסמה.', true);
          var emailInput = qs('#email');
          if (emailInput) emailInput.disabled = true;
          if (submit) submit.disabled = true;
          if (submitText) submitText.textContent = 'הקישור נשלח למייל';
        }).catch(function (err) {
          setMessage(errorText(err && err.error));
          setSubmitLoading(submit, submitText, false, 'sendReset');
        });
        return;
      }

      if (page === 'reset-password') {
        var newPassword = String((qs('#password') || {}).value || '');
        var confirmPassword = String((qs('#confirmPassword') || {}).value || '');
        if (newPassword.length < 8) { setMessage(t('invalidPassword')); return; }
        if (newPassword !== confirmPassword) { setMessage(t('mismatch')); return; }
        setSubmitLoading(submit, submitText, true, 'savePassword');
        post('/api/auth/reset-password', { password: newPassword }).then(function (result) {
          if (!result.response.ok || !result.data.ok) throw result.data;
          setMessage(t('passwordChanged'), true);
          window.setTimeout(function () { location.replace('/login?reset=1'); }, 1200);
        }).catch(function (err) {
          setMessage(errorText(err && err.error));
          setSubmitLoading(submit, submitText, false, 'savePassword');
        });
        return;
      }

      var email = String((qs('#email') || {}).value || '').trim();
      var password = String((qs('#password') || {}).value || '');
      var body = { email: email, password: password };
      if (!validEmail(email)) { setMessage(t('invalidEmail')); return; }
      if (password.length < 8) { setMessage(t('invalidPassword')); return; }
      if (page === 'register') {
        body.name = String((qs('#name') || {}).value || '').replace(/\s+/g, ' ').trim();
        body.phone = String((qs('#phone') || {}).value || '').trim();
        var compactPhone = body.phone.replace(/[\s().-]+/g, '');
        var validPhone = /^0\d{8,9}$/.test(compactPhone) || /^972\d{8,9}$/.test(compactPhone) || /^\+\d{9,15}$/.test(compactPhone);
        body.termsAccepted = !!((qs('#termsAccepted') || {}).checked);
        body.marketingEmailOptIn = !!((qs('#marketingEmailOptIn') || {}).checked);
        body.marketingSmsOptIn = !!((qs('#marketingSmsOptIn') || {}).checked);
        body.marketingWhatsappOptIn = !!((qs('#marketingWhatsappOptIn') || {}).checked);
        if (body.name.length < 2) { setMessage(t('invalidName')); return; }
        if (!validPhone) { setMessage(t('invalidPhone')); return; }
        if (password !== String((qs('#confirmPassword') || {}).value || '')) { setMessage(t('mismatch')); return; }
        if (!body.termsAccepted) { setMessage(t('termsRequired')); return; }
      }
      var labelKey = page === 'register' ? 'register' : 'login';
      setSubmitLoading(submit, submitText, true, labelKey);
      post(page === 'register' ? '/api/auth/register' : '/api/auth/login', body).then(function (result) {
        if (!result.response.ok || !result.data.ok) throw result.data;
        location.replace(safeNext());
      }).catch(function (err) {
        setMessage(errorText(err && err.error));
        setSubmitLoading(submit, submitText, false, labelKey);
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
    var currentUser = null;

    function showAccountMessage(message, ok) { setMessage(message, ok); }

    function renderOrders(orders) {
      var root = qs('#accountOrders'); if (!root) return;
      if (!orders || !orders.length) { root.innerHTML = '<p class="account-muted">עדיין אין הזמנות שמקושרות לחשבון הזה.</p>'; return; }
      root.innerHTML = orders.map(function (order) {
        var date = new Date(order.paidAt || order.createdAt || Date.now());
        var dateText = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' }).format(date);
        var amount = new Intl.NumberFormat('he-IL', { style: 'currency', currency: order.currency || 'ILS' }).format(Number(order.amount || 0));
        var items = (order.items || []).map(function (item) { return '<li>' + escapeHtml(item.name || item.id || 'מוצר') + ' × ' + Number(item.qty || 1) + '</li>'; }).join('');
        var cancellation = order.cancellation ? '<span class="account-order__request">בקשת ביטול: ' + escapeHtml(order.cancellation.requestRef) + ' · ' + escapeHtml(order.cancellation.status || 'received') + '</span>' : '<a class="account-inline-link" href="/cancel-order?order=' + encodeURIComponent(order.orderRef) + '">בקשת ביטול / החזרה</a>';
        return '<article class="account-order"><div class="account-order__top"><strong>' + escapeHtml(order.orderRef) + '</strong><span>' + escapeHtml(dateText) + '</span></div><div class="account-order__meta"><span>' + escapeHtml(amount) + '</span><span>סטטוס: ' + escapeHtml(order.status || '') + '</span></div><ul>' + items + '</ul>' + cancellation + '</article>';
      }).join('');
    }

    function loadOrders() {
      return api('/api/account/orders', 'GET').then(function (result) {
        if (!result.response.ok || !result.data.ok) throw result.data;
        renderOrders(result.data.orders || []);
      }).catch(function () { var root = qs('#accountOrders'); if (root) root.innerHTML = '<p class="account-muted">לא הצלחנו לטעון את ההזמנות כרגע.</p>'; });
    }

    function populate(user) {
      currentUser = user;
      qs('#accountLoading').hidden = true; qs('#accountDetails').hidden = false;
      qs('#accountNameInput').value = user.name || '';
      qs('#accountEmailInput').value = user.email || '';
      qs('#accountPhoneInput').value = formatPhone(user.phone || '');
      var d = new Date(user.createdAt); qs('#accountSince').textContent = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' }).format(d);
      var marketing = user.marketing || {};
      qs('#accountMarketingEmail').checked = !!marketing.email;
      qs('#accountMarketingSms').checked = !!marketing.sms;
      qs('#accountMarketingWhatsapp').checked = !!marketing.whatsapp;
      qs('#termsUpdateSection').hidden = !user.termsNeedsReview;
    }

    api('/api/auth/me', 'GET').then(function (result) {
      if (!result.response.ok || !result.data.user) { location.replace('/login?next=%2Faccount'); return; }
      populate(result.data.user); loadOrders();
    }).catch(function () { location.replace('/login?next=%2Faccount'); });

    var profile = qs('#accountProfileForm'); if (profile) profile.addEventListener('submit', function (event) {
      event.preventDefault(); showAccountMessage('');
      var name = String(qs('#accountNameInput').value || '').replace(/\s+/g, ' ').trim();
      var phone = String(qs('#accountPhoneInput').value || '').trim();
      if (name.length < 2) { showAccountMessage(t('invalidName')); return; }
      api('/api/auth/account', 'PATCH', { name: name, phone: phone }).then(function (result) {
        if (!result.response.ok || !result.data.ok) throw result.data;
        populate(result.data.user); showAccountMessage('הפרטים נשמרו.', true);
      }).catch(function (err) { showAccountMessage(errorText(err && err.error)); });
    });

    var prefs = qs('#marketingPreferencesForm'); if (prefs) prefs.addEventListener('submit', function (event) {
      event.preventDefault(); showAccountMessage('');
      api('/api/auth/marketing-preferences', 'PATCH', { email: qs('#accountMarketingEmail').checked, sms: qs('#accountMarketingSms').checked, whatsapp: qs('#accountMarketingWhatsapp').checked }).then(function (result) {
        if (!result.response.ok || !result.data.ok) throw result.data;
        populate(result.data.user); showAccountMessage('העדפות השיווק נשמרו.', true);
      }).catch(function (err) { showAccountMessage(errorText(err && err.error)); });
    });

    var acceptTerms = qs('#acceptTermsBtn'); if (acceptTerms) acceptTerms.addEventListener('click', function () {
      acceptTerms.disabled = true;
      api('/api/auth/accept-terms', 'POST', {}).then(function (result) {
        if (!result.response.ok || !result.data.ok) throw result.data;
        qs('#termsUpdateSection').hidden = true; showAccountMessage('אישור התנאים נשמר.', true);
      }).catch(function (err) { showAccountMessage(errorText(err && err.error)); acceptTerms.disabled = false; });
    });

    var deleteForm = qs('#deleteAccountForm'); if (deleteForm) deleteForm.addEventListener('submit', function (event) {
      event.preventDefault(); showAccountMessage('');
      var password = String(qs('#deleteAccountPassword').value || '');
      if (password.length < 8) { showAccountMessage(t('invalidPassword')); return; }
      if (!window.confirm('למחוק את חשבון VerSans לצמיתות? לא ניתן לבטל פעולה זו.')) return;
      api('/api/auth/account', 'DELETE', { password: password }).then(function (result) {
        if (!result.response.ok || !result.data.ok) throw result.data;
        location.replace('/shop');
      }).catch(function (err) { showAccountMessage(errorText(err && err.error)); });
    });

    var logout = qs('#logoutBtn'); if (logout) logout.addEventListener('click', function () {
      logout.disabled = true; post('/api/auth/logout', {}).then(function () { location.replace('/shop'); }).catch(function () { logout.disabled = false; showAccountMessage(t('generic')); });
    });
  }

  applyLanguage();
  bindForm();
  bindPasswordToggles();
  checkAlreadyLoggedIn();
  prepareResetPage();
  showLoginQueryMessage();
  loadAccount();
})();
