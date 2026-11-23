/* VerSans mobile product gallery indicator — isolated enhancement.
   Reads the existing thumbnail rail; it does not alter product data or the
   gallery's existing image/video selection logic. */
(function () {
  'use strict';

  var rail = document.getElementById('productThumbs');
  if (!rail || !rail.parentNode) return;

  var indicator = document.createElement('div');
  indicator.id = 'productGalleryProgress';
  indicator.className = 'product-gallery__progress';
  indicator.setAttribute('role', 'group');
  indicator.setAttribute('aria-label', 'תמונות המוצר');
  indicator.hidden = true;
  rail.parentNode.insertBefore(indicator, rail);

  var selector = '[data-gallery-index], [data-gallery-video-index]';
  var scheduled = false;

  function refresh() {
    scheduled = false;
    var thumbs = Array.prototype.slice.call(rail.querySelectorAll(selector));
    var count = thumbs.length;
    // 1–3 thumbnails split the full rail width; 4+ keep horizontal scrolling.
    var shortGallery = !rail.hidden && count > 0 && count <= 3;
    if (rail.classList.contains('is-short-gallery') !== shortGallery) {
      rail.classList.toggle('is-short-gallery', shortGallery);
    }
    if (shortGallery) {
      rail.style.setProperty('--gallery-short-count', String(count));
    } else {
      rail.style.removeProperty('--gallery-short-count');
    }
    if (rail.hidden || count <= 1) {
      indicator.hidden = true;
      indicator.replaceChildren();
      return;
    }

    if (indicator.children.length !== count) {
      indicator.replaceChildren();
      var fragment = document.createDocumentFragment();
      thumbs.forEach(function (thumb, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'product-gallery__progress-segment';
        button.dataset.progressIndex = String(index);
        var isVideo = thumb.hasAttribute('data-gallery-video-index');
        button.setAttribute('aria-label', (isVideo ? 'סרטון ' : 'תמונה ') + (index + 1) + ' מתוך ' + count);
        fragment.appendChild(button);
      });
      indicator.appendChild(fragment);
    }

    indicator.hidden = false;
    var active = thumbs.findIndex(function (thumb) { return thumb.classList.contains('is-active'); });
    if (active < 0) active = 0;
    Array.prototype.forEach.call(indicator.children, function (segment, index) {
      var isActive = index === active;
      segment.classList.toggle('is-active', isActive);
      segment.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  indicator.addEventListener('click', function (event) {
    var segment = event.target.closest('[data-progress-index]');
    if (!segment || !indicator.contains(segment)) return;
    var target = rail.querySelectorAll(selector)[Number(segment.dataset.progressIndex)];
    if (!target) return;
    target.click();
    // Show the selected thumbnail even when the rail has been scrolled away.
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    scheduleRefresh();
  });

  // The existing product.js rebuilds the rail when variations change and
  // toggles is-active on taps / image swipes. React to both automatically.
  var observer = new MutationObserver(scheduleRefresh);
  observer.observe(rail, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'hidden']
  });
  scheduleRefresh();
})();
