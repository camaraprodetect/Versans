(function () {
  'use strict';

  var root = document.getElementById('productReviewCarousel');
  if (!root || typeof PRODUCTS === 'undefined') return;

  var viewport = document.getElementById('productReviewViewport');
  var track = document.getElementById('productReviewTrack');
  var countEl = document.getElementById('productReviewCount');
  var summaryEl = document.getElementById('productReviewSummary');
  var summaryAverageEl = document.getElementById('productReviewAverage');
  var summaryCountEl = document.getElementById('productReviewSummaryCount');

  var modal = document.getElementById('productReviewDetail');
  var dialog = document.getElementById('productReviewDetailDialog');
  var modalMedia = document.getElementById('productReviewDetailMedia');
  var modalStage = document.getElementById('productReviewDetailStage');
  var modalPrev = document.getElementById('productReviewDetailPrev');
  var modalNext = document.getElementById('productReviewDetailNext');
  var modalCounter = document.getElementById('productReviewDetailCounter');
  var modalName = document.getElementById('productReviewDetailName');
  var modalVerified = document.getElementById('productReviewDetailVerified');
  var modalDate = document.getElementById('productReviewDetailDate');
  var modalStars = document.getElementById('productReviewDetailStars');
  var modalScore = document.getElementById('productReviewDetailScore');
  var modalText = document.getElementById('productReviewDetailText');

  var params = new URLSearchParams(window.location.search);
  var requestedId = params.get('id');
  var product = findProduct(requestedId) || PRODUCTS[0];
  if (!product) return;

  var reviews = [];
  var activeModalReview = null;
  var activeMediaIndex = 0;
  var lastFocused = null;
  var resumeTimer = null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var carouselIndex = 0;
  var slideStep = 0;
  var sideOffset = 0;
  var isAnimating = false;
  var isAutoplayPaused = false;
  var autoplayTimer = null;
  var resizeTimer = null;

  function findProduct(value) {
    for (var i = 0; i < PRODUCTS.length; i += 1) {
      if (String(PRODUCTS[i].id) === String(value) || String(PRODUCTS[i].slug) === String(value)) return PRODUCTS[i];
    }
    return null;
  }

  function stars(rating) {
    rating = Math.max(1, Math.min(5, Number(rating) || 0));
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
    } catch (_) {
      return '';
    }
  }

  function mediaItems(review) {
    if (review && Array.isArray(review.media)) return review.media.filter(function (item) { return item && item.url; }).slice(0, 5);
    return [];
  }

  function reviewName(review) {
    return String(review && review.name ? review.name : 'לקוח VerSans').trim() || 'לקוח VerSans';
  }

  function createSlide(review, duplicate) {
    var article = document.createElement('article');
    article.className = 'product-review-slide';
    article.setAttribute('role', 'button');
    article.tabIndex = duplicate ? -1 : 0;
    article.setAttribute('aria-label', 'פתיחת הביקורת המלאה');
    article.dataset.duplicate = duplicate ? 'true' : 'false';
    if (duplicate) article.setAttribute('aria-hidden', 'true');

    var top = document.createElement('div');
    top.className = 'product-review-slide__top';

    var reviewer = document.createElement('div');
    reviewer.className = 'product-review-slide__reviewer';

    var name = document.createElement('span');
    name.textContent = reviewName(review);
    reviewer.appendChild(name);

    if (review.verified) {
      var verified = document.createElement('span');
      verified.className = 'product-review-slide__verified';
      verified.innerHTML = '<span aria-hidden="true">V</span> מאומת';
      reviewer.appendChild(verified);
    }

    var starEl = document.createElement('span');
    starEl.className = 'product-review-slide__stars';
    starEl.setAttribute('aria-label', (review.rating || 0) + ' מתוך 5 כוכבים');
    starEl.textContent = stars(review.rating);

    top.appendChild(reviewer);
    top.appendChild(starEl);

    var text = document.createElement('blockquote');
    text.className = 'product-review-slide__text';
    text.dir = 'auto';
    text.textContent = review.text || '';

    var footer = document.createElement('div');
    footer.className = 'product-review-slide__footer';

    var date = document.createElement('time');
    date.className = 'product-review-slide__date';
    date.textContent = formatDate(review.createdAt);
    try { date.dateTime = new Date(review.createdAt).toISOString(); } catch (_) {}
    footer.appendChild(date);

    if (Number(review.mediaCount || mediaItems(review).length) > 0) {
      var mediaNote = document.createElement('span');
      mediaNote.className = 'product-review-slide__media-note';
      mediaNote.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><circle cx="9" cy="9" r="1.5"/><path d="m7 17 4-4 2.5 2.5L17 12l2 2"/></svg><span>תמונה / סרטון בביקורת</span>';
      footer.appendChild(mediaNote);
    }

    article.appendChild(top);
    article.appendChild(text);
    article.appendChild(footer);

    article.addEventListener('click', function () { openReview(review); });
    if (!duplicate) {
      article.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openReview(review);
        }
      });
    }
    return article;
  }

  function getSlides() {
    return track ? track.querySelectorAll('.product-review-slide') : [];
  }

  function clearAutoplay() {
    if (autoplayTimer) {
      window.clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function scheduleAutoplay(delay) {
    clearAutoplay();
    if (!track || reduceMotion || reviews.length < 2 || document.hidden || isAutoplayPaused || (modal && !modal.hidden)) return;
    autoplayTimer = window.setTimeout(function () {
      goToNext();
    }, typeof delay === 'number' ? delay : 3000);
  }

  function stopAutoplay() {
    isAutoplayPaused = true;
    clearAutoplay();
  }

  function startAutoplay() {
    isAutoplayPaused = false;
    scheduleAutoplay(3000);
  }

  function restartAutoplaySoon(delay) {
    if (resumeTimer) window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(function () {
      isAutoplayPaused = false;
      scheduleAutoplay(typeof delay === 'number' ? delay : 900);
    }, typeof delay === 'number' ? delay : 900);
  }

  function updateMetrics() {
    if (!track || !viewport) return;
    var slides = getSlides();
    if (!slides.length) return;
    var referenceSlide = slides.length > 1 ? slides[1] : slides[0];
    if (!referenceSlide) return;
    var gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || '0') || 0;
    var rect = referenceSlide.getBoundingClientRect();
    slideStep = rect.width + gap;
    sideOffset = Math.max(0, (viewport.clientWidth - rect.width) / 2);
  }

  function applyPosition(withoutAnimation) {
    if (!track) return;
    if (withoutAnimation) {
      track.classList.add('is-jump-reset');
    } else {
      track.classList.remove('is-jump-reset');
    }
    var translate = sideOffset - (carouselIndex * slideStep);
    track.style.transform = 'translate3d(' + translate + 'px,0,0)';
  }

  function goToNext() {
    if (!track || reviews.length < 2 || isAnimating) return;
    clearAutoplay();
    isAnimating = true;
    track.classList.remove('is-jump-reset');
    carouselIndex += 1;
    applyPosition(false);
  }

  function onTransitionEnd(event) {
    if (!track || event.target !== track || event.propertyName !== 'transform') return;
    isAnimating = false;

    if (reviews.length > 1) {
      if (carouselIndex === reviews.length + 1) {
        carouselIndex = 1;
        applyPosition(true);
        void track.offsetWidth;
      } else if (carouselIndex === 0) {
        carouselIndex = reviews.length;
        applyPosition(true);
        void track.offsetWidth;
      }
    }

    if (!isAutoplayPaused && (!modal || modal.hidden)) scheduleAutoplay(3000);
  }

  function renderCarousel() {
    if (!track) return;
    track.textContent = '';
    track.classList.remove('is-static', 'is-jump-reset');
    track.style.transform = 'translate3d(0,0,0)';
    clearAutoplay();
    isAnimating = false;
    carouselIndex = 0;

    if (!reviews.length) {
      root.hidden = true;
      if (summaryEl) summaryEl.hidden = true;
      return;
    }

    root.hidden = false;
    if (countEl) countEl.textContent = reviews.length === 1 ? 'ביקורת אחת' : reviews.length + ' ביקורות';
    if (summaryEl) {
      var totalRating = reviews.reduce(function (sum, review) { return sum + (Number(review.rating) || 0); }, 0);
      var averageRating = totalRating / reviews.length;
      summaryEl.hidden = false;
      if (summaryAverageEl) summaryAverageEl.textContent = averageRating.toFixed(1) + '/5';
      if (summaryCountEl) summaryCountEl.textContent = reviews.length === 1 ? 'ביקורת אחת' : reviews.length + ' ביקורות';
    }

    if (reviews.length === 1 || reduceMotion) {
      track.classList.add('is-static');
      track.appendChild(createSlide(reviews[0], false));
      return;
    }

    track.appendChild(createSlide(reviews[reviews.length - 1], true));
    reviews.forEach(function (review) {
      track.appendChild(createSlide(review, false));
    });
    track.appendChild(createSlide(reviews[0], true));

    carouselIndex = 1;
    window.requestAnimationFrame(function () {
      updateMetrics();
      applyPosition(true);
      void track.offsetWidth;
      scheduleAutoplay(3000);
    });
  }

  function fetchPage(offset) {
    var url = '/api/reviews?productId=' + encodeURIComponent(product.id) + '&limit=24&offset=' + offset;
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('reviews_load_failed');
        return response.json();
      });
  }

  function loadAllReviews() {
    var collected = [];
    function next(offset) {
      return fetchPage(offset).then(function (payload) {
        var pageReviews = payload && Array.isArray(payload.reviews) ? payload.reviews : [];
        collected = collected.concat(pageReviews);
        var pagination = payload && payload.pagination ? payload.pagination : null;
        if (pagination && pagination.hasMore && Number(pagination.nextOffset) > offset) return next(Number(pagination.nextOffset));
        return collected;
      });
    }
    return next(0).then(function (items) {
      reviews = items;
      renderCarousel();
    }).catch(function () {
      root.hidden = true;
    });
  }

  function renderModalMedia() {
    if (!activeModalReview) return;
    var items = mediaItems(activeModalReview);
    if (!items.length) {
      modalMedia.hidden = true;
      dialog.classList.add('is-no-media');
      modalStage.textContent = '';
      return;
    }

    dialog.classList.remove('is-no-media');
    modalMedia.hidden = false;
    activeMediaIndex = Math.max(0, Math.min(activeMediaIndex, items.length - 1));
    modalStage.textContent = '';
    var item = items[activeMediaIndex];
    if (item.kind === 'video') {
      var video = document.createElement('video');
      video.className = 'product-review-detail__video';
      video.src = item.url;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      modalStage.appendChild(video);
    } else {
      var image = document.createElement('img');
      image.className = 'product-review-detail__image';
      image.src = item.url;
      image.alt = 'תמונה מתוך הביקורת';
      modalStage.appendChild(image);
    }

    var multiple = items.length > 1;
    modalPrev.hidden = !multiple;
    modalNext.hidden = !multiple;
    modalCounter.hidden = !multiple;
    modalCounter.textContent = multiple ? (activeMediaIndex + 1) + ' / ' + items.length : '';
  }

  function openReview(review) {
    if (!modal || !review) return;
    stopAutoplay();
    lastFocused = document.activeElement;
    activeModalReview = review;
    activeMediaIndex = 0;
    if (modalName) modalName.textContent = reviewName(review);
    modalVerified.hidden = !review.verified;
    modalDate.textContent = formatDate(review.createdAt);
    try { modalDate.dateTime = new Date(review.createdAt).toISOString(); } catch (_) {}
    modalStars.textContent = stars(review.rating);
    modalScore.textContent = review.rating + ' / 5';
    modalText.textContent = review.text || '';
    renderModalMedia();
    modal.hidden = false;
    document.body.classList.add('product-review-detail-open');
    window.setTimeout(function () {
      var close = modal.querySelector('[data-product-review-close]');
      if (close) close.focus();
    }, 0);
  }

  function closeReview() {
    if (!modal || modal.hidden) return;
    var video = modalStage.querySelector('video');
    if (video) video.pause();
    modal.hidden = true;
    document.body.classList.remove('product-review-detail-open');
    activeModalReview = null;
    modalStage.textContent = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    restartAutoplaySoon(450);
  }

  function moveModalMedia(delta) {
    if (!activeModalReview) return;
    var items = mediaItems(activeModalReview);
    if (items.length < 2) return;
    activeMediaIndex = (activeMediaIndex + delta + items.length) % items.length;
    renderModalMedia();
  }

  if (viewport) {
    viewport.addEventListener('focusin', stopAutoplay);
    viewport.addEventListener('focusout', function (event) {
      if (!viewport.contains(event.relatedTarget)) restartAutoplaySoon(250);
    });
    viewport.addEventListener('touchstart', stopAutoplay, { passive: true });
    viewport.addEventListener('touchend', function () { restartAutoplaySoon(1200); }, { passive: true });
    viewport.addEventListener('touchcancel', function () { restartAutoplaySoon(1200); }, { passive: true });
  }

  if (track) {
    track.addEventListener('transitionend', onTransitionEnd);
  }

  window.addEventListener('resize', function () {
    if (!track || reviews.length < 2 || reduceMotion) return;
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      updateMetrics();
      applyPosition(true);
    }, 80);
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-product-review-close]'), function (button) {
    button.addEventListener('click', closeReview);
  });
  if (modalPrev) modalPrev.addEventListener('click', function () { moveModalMedia(-1); });
  if (modalNext) modalNext.addEventListener('click', function () { moveModalMedia(1); });

  document.addEventListener('keydown', function (event) {
    if (modal && !modal.hidden) {
      if (event.key === 'Escape') closeReview();
      else if (event.key === 'ArrowLeft') moveModalMedia(-1);
      else if (event.key === 'ArrowRight') moveModalMedia(1);
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearAutoplay();
    } else if (!modal || modal.hidden) {
      scheduleAutoplay(900);
    }
  });

  if (summaryCountEl) {
    summaryCountEl.addEventListener('click', function () {
      if (!root.hidden) root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
  }

  loadAllReviews();
}());
