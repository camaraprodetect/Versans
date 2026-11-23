/* VerSans: narrow, same-session password confirmation for product price edits.
   Only intercepts PUT /api/admin/catalog/product-* after HTTP 428 reauth_required.
   The server still decides permissions, prices, password validity and whether to save. */
(function () {
  'use strict';
  if (window.__versansProductPriceReauthLoaded) return;
  window.__versansProductPriceReauthLoaded = true;

  var previousFetch = window.fetch.bind(window);
  var activePrompt = null;

  function tag(name, text) {
    var item = document.createElement(name);
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function askForPassword() {
    if (activePrompt) return activePrompt;
    activePrompt = new Promise(function (resolve) {
      // Keep the prompt attached to the editor, not to a blocked browser popup.
      var target = document.querySelector('.versans-editor__footer') ||
        document.querySelector('.admin-catalog-form') ||
        document.querySelector('.admin-catalog-section') || document.body;
      var panel = tag('div');
      panel.className = 'versans-price-reauth';
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-label', 'אימות סיסמה לשינוי מחיר');
      panel.dir = 'rtl';
      panel.style.cssText = 'display:grid;gap:10px;margin:12px 0;padding:15px;border:2px solid #d1a34d;border-radius:12px;background:#fffaf0;color:#142333;font:600 14px/1.55 Arial,sans-serif;box-sizing:border-box;';

      var heading = tag('strong', 'אימות סיסמה לשינוי מחיר');
      var explanation = tag('p', 'כדי לשמור שינוי במחיר או במחיר לפני הנחה, הזן את הסיסמה של החשבון המחובר כעת.');
      explanation.style.cssText = 'margin:0;color:#526274;font-size:13px;';
      var password = tag('input');
      password.type = 'password';
      password.required = true;
      password.autocomplete = 'current-password';
      password.placeholder = 'סיסמת החשבון שלך';
      password.setAttribute('aria-label', 'סיסמת החשבון לאישור שינוי מחיר');
      password.style.cssText = 'box-sizing:border-box;width:100%;min-height:44px;padding:10px;border:1px solid #acb8c7;border-radius:8px;background:#fff;color:#142333;font:inherit;';
      var error = tag('p');
      error.setAttribute('role', 'alert');
      error.style.cssText = 'color:#aa2333;margin:0;font-size:12px;';
      var buttons = tag('div');
      buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
      var confirm = tag('button', 'אמת ושמור');
      confirm.type = 'button';
      confirm.style.cssText = 'cursor:pointer;border:0;border-radius:8px;padding:10px 16px;background:#142333;color:white;font:inherit;';
      var cancel = tag('button', 'ביטול');
      cancel.type = 'button';
      cancel.style.cssText = 'cursor:pointer;border:1px solid #bcc7d3;border-radius:8px;padding:10px 16px;background:white;color:#142333;font:inherit;';

      var completed = false;
      function finish(success) {
        if (completed) return;
        completed = true;
        password.value = '';
        panel.remove();
        activePrompt = null;
        resolve(success);
      }
      cancel.addEventListener('click', function () { finish(false); });
      password.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        if (event.key === 'Enter') { event.preventDefault(); confirm.click(); }
      });
      confirm.addEventListener('click', async function () {
        if (!password.value || completed) return;
        confirm.disabled = true;
        error.textContent = '';
        try {
          var response = await previousFetch('/api/admin/employees/reauth', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password.value })
          });
          var payload = await response.json().catch(function () { return {}; });
          if (response.ok && payload.ok === true) { finish(true); return; }
          var messages = {
            reauth_failed: 'הסיסמה שגויה. הזן את הסיסמה של החשבון שמחובר עכשיו.',
            reauth_rate_limited: 'בוצעו יותר מדי ניסיונות. נסה שוב מאוחר יותר.',
            admin_required: 'ההתחברות פגה. התנתק והתחבר מחדש.',
            permission_denied: 'אין לחשבון הרשאה לבצע שינוי זה.',
            origin_not_allowed: 'האימות נחסם. פתח את האדמין מכתובת האתר הרגילה.'
          };
          error.textContent = messages[payload.error] || 'האימות נכשל. בדוק את הסיסמה ונסה שוב.';
          password.value = '';
          password.focus();
        } catch (failure) {
          error.textContent = 'שגיאת תקשורת באימות. נסה שוב.';
          password.value = '';
          password.focus();
        } finally {
          if (!completed) confirm.disabled = false;
        }
      });
      buttons.appendChild(confirm);
      buttons.appendChild(cancel);
      panel.appendChild(heading);
      panel.appendChild(explanation);
      panel.appendChild(password);
      panel.appendChild(error);
      panel.appendChild(buttons);
      // The product editor's footer is fixed; insert above its save buttons.
      var actions = target.querySelector('.versans-editor__footer-actions, .admin-catalog-actions');
      if (actions) target.insertBefore(panel, actions);
      else target.appendChild(panel);
      password.focus();
    });
    return activePrompt;
  }

  window.fetch = async function (input, init) {
    var request;
    try { request = new Request(input, init); }
    catch (_) { return previousFetch(input, init); }
    var url;
    try { url = new URL(request.url, location.href); }
    catch (_) { return previousFetch(request); }
    // Never intercept any payment, account or non-catalog request.
    if (url.origin !== location.origin || request.method !== 'PUT' ||
        !/^\/api\/admin\/catalog\/product-[a-z0-9-]+$/.test(url.pathname)) {
      return previousFetch(request);
    }

    // This one endpoint has its own inline challenge; older global wrappers
    // must not show a second popup or retry with a different product body.
    var headers = new Headers(request.headers);
    headers.set('X-Versans-Admin-Reauth', 'managed');
    var authenticatedRequest = new Request(request, { headers: headers });
    var response = await previousFetch(authenticatedRequest.clone());
    if (response.status !== 428) return response;
    var payload = await response.clone().json().catch(function () { return {}; });
    if (payload.error !== 'reauth_required') return response;
    if (!await askForPassword()) return response;
    // Replay the exact same request only once, after the server confirms the
    // current session's password. A second 428 is returned to the caller.
    return previousFetch(authenticatedRequest.clone());
  };
})();
