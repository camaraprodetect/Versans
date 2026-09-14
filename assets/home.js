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
