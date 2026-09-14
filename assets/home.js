/* Home-only copy is loaded after the shared dictionary and before store.js.
   The storefront is rendered in Hebrew only. */
(function () {
  'use strict';
  var copy = {
    he: {
      'hero.eyebrow': 'למי שתמיד בלב',
      'hero.line1': 'תכשיט קטן.',
      'hero.line2': 'משמעות גדולה.',
      'hero.sub': 'תכשיטים ליום־יום ומתנות עם מילים משלכם. בחרו משהו יפה למישהו שעושה לכם טוב.',
      'hero.cta': 'לגלות את הקולקציה',
      'hero.cta2': 'לביקורות הלקוחות',
      'nav.how': 'ביקורות',
      'reviews.eyebrow': 'החוויות שלכם עם VerSans',
      'reviews.title': 'ביקורות לקוחות',
      'reviews.empty': 'ביקורות הלקוחות יופיעו כאן בקרוב.',
      'faq.eyebrow': 'לפני שמעניקים',
      'faq.title': 'כל מה שחשוב לדעת.',
      'faq.intro': 'משלוח, ברכה אישית ותשלום - הפרטים שיעזרו לכם לבחור בראש שקט.',
      'foot.about': 'תכשיטים ליום־יום ומתנות עם מסר אישי, לאנשים שתמיד קרובים ללב.',
      'foot.contact': 'אנחנו כאן בשבילכם',
      'foot.contact.note': 'שאלה על מתנה או הזמנה? כתבו לנו.',
      'foot.materials': 'חומרים וציפויים',
      'foot.cancel': 'ביטול עסקה'
    },
  };
  Object.keys(copy).forEach(function (lang) {
    Object.keys(copy[lang]).forEach(function (key) {
      I18N[lang][key] = copy[lang][key];
    });
  });
}());


/* Home hero slideshow: original image first, then the two promotional images, looping every 6s. */
(function () {
  'use strict';

  function initHeroSlider() {
    var root = document.querySelector('[data-hero-slider]');
    if (!root) return;

    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-hero-slide]'));
    if (slides.length < 2) return;

    var current = 0;
    var timer = null;

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        var active = i === current;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
    }

    function start() {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(function () { show(current + 1); }, 6000);
    }

    show(0);
    start();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (timer) window.clearInterval(timer);
        timer = null;
      } else {
        start();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroSlider, { once: true });
  } else {
    initHeroSlider();
  }
}());


/* SEO metadata for crawlable collection URLs such as /?cat=watches. */
(function () {
  'use strict';
  var COLLECTION_SEO = {
    greeting: ['תכשיט עם ברכה - VerSans', 'תכשיטים עם ברכה ומסר אישי מבית VerSans. מתנות מרגשות עם אפשרויות עיצוב והתאמה אישית.'],
    'greeting-mom': ['תכשיט עם ברכה לאמא - VerSans', 'מתנות ותכשיטים עם ברכה לאמא מבית VerSans.'],
    'greeting-partner': ['תכשיט עם ברכה לבת זוג - VerSans', 'תכשיטים ומתנות עם מסר אישי לבת הזוג מבית VerSans.'],
    'greeting-daughter': ['תכשיט עם ברכה לבת - VerSans', 'תכשיטים ומתנות עם ברכה לבת מבית VerSans.'],
    'greeting-sister': ['תכשיט עם ברכה לאחות - VerSans', 'תכשיטים ומתנות עם ברכה לאחות מבית VerSans.'],
    necklaces: ['שרשראות - VerSans', 'קולקציית השרשראות של VerSans - דגמים לנשים, לגברים ומתנות עם משמעות.'],
    bracelets: ['צמידים - VerSans', 'קולקציית הצמידים של VerSans - דגמים יוניסקס, מתנות ועיצובים ליום יום.'],
    'photo-bracelets': ['צמידי תמונה - VerSans', 'צמידי תמונה והקרנה בעיצוב אישי מבית VerSans.'],
    watches: ['שעונים - VerSans', 'קולקציית השעונים של VerSans - שעוני גברים, נשים ומארזי מתנה.'],
    glasses: ['משקפי שמש - VerSans', 'קולקציית משקפי השמש של VerSans - דגמים לנשים, גברים ויוניסקס.'],
    'glasses-men': ['משקפי שמש לגברים - VerSans', 'משקפי שמש לגברים מבית VerSans במגוון דגמים ועיצובים.'],
    'glasses-women': ['משקפי שמש לנשים - VerSans', 'משקפי שמש לנשים מבית VerSans במגוון דגמים ועיצובים.'],
    'glasses-unisex': ['משקפי שמש יוניסקס - VerSans', 'משקפי שמש יוניסקס מבית VerSans במגוון דגמים ועיצובים.'],
    'gift-boxes': ['מארזי מתנה - VerSans', 'מארזי מתנה של VerSans עם תכשיטים ושעונים בעיצוב יוקרתי.'],
    custom: ['עיצוב אישי - VerSans', 'מתנות ותכשיטים בעיצוב אישי מבית VerSans - ברכות, שמות ותמונות בהתאמה אישית.'],
    sets: ['סטים - VerSans', 'סטים ומארזים מבית VerSans למתנה או ליום יום.']
  };
  function setMeta(selector, value) {
    var el = document.querySelector(selector);
    if (el && value) el.setAttribute('content', value);
  }
  try {
    var cat = new URLSearchParams(window.location.search).get('cat');
    var seo = COLLECTION_SEO[cat];
    var title = seo ? seo[0] : 'VerSans - תכשיטים, שעונים, משקפי שמש ומתנות בעיצוב אישי';
    var description = seo ? seo[1] : 'VerSans - תכשיטים, שעונים, משקפי שמש, מארזי מתנה ותכשיטים בעיצוב אישי. קנייה אונליין עם משלוח חינם.';
    var canonical = seo ? 'https://versans.com/?cat=' + encodeURIComponent(cat) : 'https://versans.com/';
    document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', canonical);
    var canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) canonicalEl.setAttribute('href', canonical);
  } catch (e) {}
})();
