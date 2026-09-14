(function () {
  'use strict';

  var PAGE_SIZE = 12;
  var MAX_MEDIA = 5;
  var MAX_VIDEO_BYTES = 20 * 1024 * 1024;

  var grid = document.getElementById('reviewsGrid');
  var empty = document.getElementById('reviewsEmpty');
  var loading = document.getElementById('reviewsLoading');
  var template = document.getElementById('reviewCardTemplate');
  var summary = document.getElementById('reviewsSummary');
  var averageEl = document.getElementById('reviewsAverage');
  var summaryStars = document.getElementById('reviewsSummaryStars');
  var countEl = document.getElementById('reviewsCount');
  var loadMoreWrap = document.getElementById('reviewsLoadMoreWrap');
  var loadMoreBtn = document.getElementById('reviewsLoadMore');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('[data-reviews-rating]'));
  var filterCountEls = Array.prototype.slice.call(document.querySelectorAll('[data-reviews-count]'));
  var emptyText = empty ? empty.querySelector('p') : null;

  var openBtn = document.getElementById('openReviewModal');
  var modal = document.getElementById('reviewModal');
  var form = document.getElementById('reviewForm');
  var loginRequired = document.getElementById('reviewLoginRequired');
  var verifiedRequired = document.getElementById('reviewVerifiedRequired');
  var userLine = document.getElementById('reviewUserLine');
  var phoneInput = document.getElementById('reviewPhone');
  var dateInput = document.getElementById('reviewDate');
  var textInput = document.getElementById('reviewText');
  var textCount = document.getElementById('reviewTextCount');
  var mediaInput = document.getElementById('reviewImages');
  var dropZone = document.getElementById('reviewDropzone');
  var mediaPreviews = document.getElementById('reviewImagePreviews');
  var mediaCount = document.getElementById('reviewImageCount');
  var message = document.getElementById('reviewFormMessage');
  var submit = document.getElementById('reviewSubmit');
  var starButtons = Array.prototype.slice.call(document.querySelectorAll('[data-review-rating]'));

  var detailModal = document.getElementById('reviewDetailModal');
  var detailDialog = document.getElementById('reviewDetailDialog');
  var detailMedia = document.getElementById('reviewDetailMedia');
  var detailStage = document.getElementById('reviewDetailStage');
  var detailPrev = document.getElementById('reviewDetailPrev');
  var detailNext = document.getElementById('reviewDetailNext');
  var detailCounter = document.getElementById('reviewDetailCounter');
  var detailVerified = document.getElementById('reviewDetailVerified');
  var detailDate = document.getElementById('reviewDetailDate');
  var detailStars = document.getElementById('reviewDetailStars');
  var detailScore = document.getElementById('reviewDetailScore');
  var detailText = document.getElementById('reviewDetailText');
  var detailProduct = document.getElementById('reviewDetailProduct');
  var detailProductImage = document.getElementById('reviewDetailProductImage');
  var detailProductTitle = document.getElementById('reviewDetailProductTitle');
  var detailProductVariant = document.getElementById('reviewDetailProductVariant');

  if (!grid || !template || !modal || !form || !openBtn) return;

  var currentUser = null;
  var selectedRating = 0;
  var mediaItems = [];
  var mediaSequence = 0;
  var mediaJobs = 0;
  var lastFocused = null;

  var nextOffset = 0;
  var totalReviews = 0;
  var currentResultTotal = 0;
  var activeRatingFilter = 0;
  var loadingPage = false;
  var reviewsById = Object.create(null);

  var activeDetailReview = null;
  var activeDetailMediaIndex = 0;
  var detailLastFocused = null;

  function starsText(rating) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  function reviewDate(timestamp) {
    try {
      return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(timestamp));
    } catch (_) {
      return '';
    }
  }

  function mediaForReview(review) {
    if (review && Array.isArray(review.media) && review.media.length) return review.media.slice(0, MAX_MEDIA);
    var urls = review && Array.isArray(review.imageUrls) ? review.imageUrls.slice(0, MAX_MEDIA) : [];
    if (!urls.length && review && review.imageUrl) urls = [review.imageUrl];
    return urls.map(function (url) { return { kind: 'image', url: url, mime: null }; });
  }

  function renderReviewMedia(card, review) {
    var media = card.querySelector('.review-card__media');
    if (!media) return false;
    var items = mediaForReview(review);
    if (!items.length) {
      media.hidden = true;
      card.classList.remove('has-review-media');
      return false;
    }

    media.textContent = '';
    var first = items[0];
    if (first.kind === 'video') {
      var video = document.createElement('video');
      video.className = 'review-card__video';
      video.src = first.url;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('aria-label', 'סרטון שצורף לביקורת');
      media.appendChild(video);

      var play = document.createElement('span');
      play.className = 'review-card__play';
      play.setAttribute('aria-hidden', 'true');
      play.textContent = '▶';
      media.appendChild(play);
    } else {
      var image = document.createElement('img');
      image.className = 'review-card__image';
      image.src = first.url;
      image.alt = 'תמונה שצורפה לביקורת';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', function () {
        media.hidden = true;
        card.classList.remove('has-review-media');
      }, { once: true });
      media.appendChild(image);
    }

    if (items.length > 1) {
      var count = document.createElement('span');
      count.className = 'review-card__image-count';
      count.textContent = '+' + (items.length - 1);
      count.setAttribute('aria-label', 'עוד ' + (items.length - 1) + ' קבצי מדיה');
      media.appendChild(count);
    }

    media.hidden = false;
    card.classList.add('has-review-media');
    return true;
  }

  function renderReviewProduct(card, review) {
    var product = review && review.product ? review.product : null;
    var link = card.querySelector('.review-card__product');
    if (!link) return;
    if (!product) {
      link.hidden = true;
      return;
    }
    link.hidden = false;
    link.href = product.href || '/mom-heart-necklace';
    var image = link.querySelector('.review-card__product-image');
    var title = link.querySelector('.review-card__product-title');
    var variant = link.querySelector('.review-card__product-variant');
    if (image) {
      image.src = product.imageUrl || 'images/review-products/necklace-1.png';
      image.alt = product.title || 'המוצר שנרכש';
    }
    if (title) title.textContent = product.title || 'שרשרת לאמא עם ברכה והקדשה מרגשת';
    if (variant) {
      variant.textContent = product.variantLabel || '';
      variant.hidden = !product.variantLabel;
    }
  }

  function updateSummary(info) {
    info = info || { count: totalReviews, average: 0 };
    totalReviews = Number(info.count || 0);
    if (totalReviews > 0) {
      // VerSans displays the storefront score as 4.8 by design.
      averageEl.textContent = '4.8';
      summaryStars.textContent = starsText(5);
      countEl.textContent = totalReviews === 1 ? 'ביקורת אחת' : totalReviews + ' ביקורות';
      summary.hidden = false;
    } else {
      summary.hidden = true;
    }
  }

  function updateRatingCounts(counts) {
    counts = counts || {};
    filterCountEls.forEach(function (el) {
      var rating = String(el.getAttribute('data-reviews-count') || '');
      var value = Number(counts[rating] || 0);
      el.textContent = '(' + value + ')';
      var button = el.closest('[data-reviews-rating]');
      if (button) {
        button.setAttribute('aria-label', rating + ' כוכבים, ' + value + (value === 1 ? ' ביקורת' : ' ביקורות'));
      }
    });
  }

  function updateLoadMore(pagination) {
    if (!loadMoreWrap || !loadMoreBtn) return;
    var resultTotal = pagination && Number.isFinite(Number(pagination.total))
      ? Number(pagination.total)
      : currentResultTotal;
    var hasMore = pagination ? !!pagination.hasMore : nextOffset < resultTotal;
    loadMoreWrap.hidden = !hasMore;
    if (!hasMore) return;
    loadMoreBtn.textContent = 'הצג עוד ביקורות';
    loadMoreBtn.disabled = false;
  }

  function createReviewCard(review) {
    var card = template.content.firstElementChild.cloneNode(true);
    var stars = card.querySelector('.review-card__stars');
    var score = card.querySelector('.review-card__score');
    var date = card.querySelector('.review-card__date');
    var name = card.querySelector('.review-card__name');
    var verified = card.querySelector('.review-card__verified');

    card.dataset.reviewId = String(review.id);
    card.tabIndex = 0;
    card.setAttribute('aria-label', 'פתיחת הביקורת המלאה');
    card.classList.add('review-card--clickable');

    stars.textContent = starsText(review.rating);
    score.textContent = review.rating + ' / 5';
    card.querySelector('.review-card__text').textContent = review.text;
    name.textContent = 'לקוח VerSans';
    if (verified) verified.hidden = !review.verified;
    date.textContent = reviewDate(review.createdAt);
    date.dateTime = new Date(review.createdAt).toISOString();
    renderReviewMedia(card, review);
    renderReviewProduct(card, review);

    card.addEventListener('click', function (event) {
      if (event.target.closest('a,button,input,textarea,select')) return;
      openReviewDetail(review);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target.closest('a,button,input,textarea,select')) return;
        event.preventDefault();
        openReviewDetail(review);
      }
    });
    return card;
  }

  function renderReviews(payload, reset) {
    if (reset) {
      grid.textContent = '';
      reviewsById = Object.create(null);
    }
    var reviews = payload && Array.isArray(payload.reviews) ? payload.reviews : [];
    var fragment = document.createDocumentFragment();

    reviews.forEach(function (review) {
      reviewsById[String(review.id)] = review;
      fragment.appendChild(createReviewCard(review));
    });
    grid.appendChild(fragment);

    var pagination = payload && payload.pagination ? payload.pagination : null;
    if (pagination) {
      nextOffset = Number(pagination.nextOffset || 0);
      currentResultTotal = Number.isFinite(Number(pagination.total)) ? Number(pagination.total) : reviews.length;
    } else {
      nextOffset += reviews.length;
      currentResultTotal = reset ? reviews.length : currentResultTotal + reviews.length;
    }

    updateSummary(payload && payload.summary);
    updateRatingCounts(payload && payload.summary && payload.summary.ratingCounts);
    updateLoadMore(pagination);

    loading.hidden = true;
    grid.hidden = currentResultTotal === 0;
    empty.hidden = currentResultTotal !== 0;
    if (emptyText) {
      emptyText.textContent = activeRatingFilter
        ? 'אין כרגע ביקורות של ' + activeRatingFilter + ' כוכבים.'
        : 'עדיין אין ביקורות. אתם יכולים להיות הראשונים.';
    }
  }

  function loadReviews(reset) {
    if (loadingPage) return Promise.resolve();
    loadingPage = true;
    var offset = reset ? 0 : nextOffset;
    if (reset) {
      nextOffset = 0;
      loading.hidden = false;
      loading.textContent = 'טוען ביקורות…';
      if (loadMoreWrap) loadMoreWrap.hidden = true;
    } else if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'טוען…';
    }

    var query = '/api/reviews?limit=' + PAGE_SIZE + '&offset=' + offset;
    if (activeRatingFilter) query += '&rating=' + encodeURIComponent(activeRatingFilter);

    return fetch(query, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('reviews_load_failed');
      return response.json();
    }).then(function (payload) {
      renderReviews(payload, !!reset);
    }).catch(function () {
      if (reset) {
        loading.textContent = 'לא הצלחנו לטעון את הביקורות. נסו לרענן את הדף.';
        empty.hidden = true;
        grid.hidden = true;
      } else if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'נסו שוב';
      }
    }).then(function () {
      loadingPage = false;
    });
  }

  function loadUser() {
    return fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) { currentUser = data && data.user ? data.user : null; })
      .catch(function () { currentUser = null; });
  }

  function setRating(value) {
    selectedRating = value;
    starButtons.forEach(function (button) {
      var rating = Number(button.getAttribute('data-review-rating'));
      var active = rating <= value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', rating === value ? 'true' : 'false');
    });
  }

  function setMessage(text, isError) {
    message.textContent = text || '';
    message.classList.toggle('is-error', !!text && !!isError);
    message.classList.toggle('is-ok', !!text && !isError);
  }

  function updateMediaCount() {
    if (mediaCount) mediaCount.textContent = mediaItems.length + ' / ' + MAX_MEDIA;
    if (dropZone) dropZone.classList.toggle('is-full', mediaItems.length >= MAX_MEDIA);
  }

  function renderMediaPreviews() {
    if (!mediaPreviews) return;
    mediaPreviews.textContent = '';
    mediaItems.forEach(function (item, index) {
      var preview = document.createElement('div');
      preview.className = 'review-image-preview review-media-preview';

      var visual;
      if (item.kind === 'video') {
        visual = document.createElement('video');
        visual.src = item.dataUrl;
        visual.muted = true;
        visual.playsInline = true;
        visual.preload = 'metadata';
        visual.controls = true;
      } else {
        visual = document.createElement('img');
        visual.src = item.dataUrl;
        visual.alt = 'תצוגה מקדימה של תמונה ' + (index + 1);
      }

      var meta = document.createElement('div');
      meta.className = 'review-image-preview__meta';
      var label = document.createElement('strong');
      label.textContent = item.kind === 'video' ? 'סרטון ' + (index + 1) : 'תמונה ' + (index + 1);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'הסרה';
      remove.addEventListener('click', function () {
        mediaItems = mediaItems.filter(function (candidate) { return candidate.id !== item.id; });
        renderMediaPreviews();
        setMessage(mediaItems.length ? mediaItems.length + ' קבצים מוכנים.' : '');
      });

      meta.appendChild(label);
      meta.appendChild(remove);
      preview.appendChild(visual);
      preview.appendChild(meta);
      mediaPreviews.appendChild(preview);
    });
    mediaPreviews.hidden = mediaItems.length === 0;
    updateMediaCount();
  }

  function resetMedia() {
    mediaItems = [];
    mediaJobs = 0;
    if (mediaInput) mediaInput.value = '';
    renderMediaPreviews();
  }

  function localDateValue(date) {
    var value = date || new Date();
    var local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function resetForm() {
    form.reset();
    if (dateInput) {
      var today = localDateValue(new Date());
      dateInput.value = today;
      dateInput.max = today;
    }
    setRating(0);
    resetMedia();
    setMessage('');
    textCount.textContent = '0 / 1200';
    submit.disabled = false;
    submit.textContent = 'פרסום הביקורת';
  }

  function updateModalMode() {
    var loggedIn = !!currentUser;
    var verified = loggedIn && !!currentUser.isVerifiedCustomer;
    form.hidden = !verified;
    loginRequired.hidden = loggedIn;
    verifiedRequired.hidden = !loggedIn || verified;
    if (verified) userLine.textContent = 'לקוח VerSans מאומת · הביקורת תוצג בשם "לקוח VerSans".';
  }

  function openModal() {
    lastFocused = document.activeElement;
    resetForm();
    updateModalMode();
    modal.hidden = false;
    document.body.classList.add('review-modal-open');
    var focusTarget = currentUser
      ? (currentUser.isVerifiedCustomer ? phoneInput : verifiedRequired.querySelector('a,button'))
      : loginRequired.querySelector('a');
    setTimeout(function () { if (focusTarget) focusTarget.focus(); }, 0);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('review-modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('לא הצלחנו לקרוא את הקובץ.')); };
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.readAsDataURL(file);
    });
  }

  function fileToOptimizedImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) {
        reject(new Error('אפשר להוסיף תמונות PNG, JPG או WebP.'));
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        reject(new Error('אחת התמונות גדולה מדי. בחרו תמונה עד 15MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('לא הצלחנו לקרוא אחת התמונות.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('אחד מקובצי התמונה אינו תקין.')); };
        img.onload = function () {
          var maxSide = 1600;
          var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          var width = Math.max(1, Math.round(img.naturalWidth * scale));
          var height = Math.max(1, Math.round(img.naturalHeight * scale));
          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          var qualities = [0.84, 0.72, 0.60, 0.50];
          var dataUrl = '';
          for (var i = 0; i < qualities.length; i += 1) {
            dataUrl = canvas.toDataURL('image/jpeg', qualities[i]);
            if (dataUrl.length <= 2.5 * 1024 * 1024) break;
          }
          if (dataUrl.length > 2.5 * 1024 * 1024) {
            reject(new Error('אחת התמונות עדיין גדולה מדי לאחר אופטימיזציה. נסו תמונה קטנה יותר.'));
            return;
          }
          resolve({ kind: 'image', dataUrl: dataUrl });
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function fileToMediaItem(file) {
    if (/^image\/(png|jpeg|webp)$/i.test(file.type || '')) return fileToOptimizedImage(file);
    if (/^video\/(mp4|webm)$/i.test(file.type || '')) {
      if (file.size > MAX_VIDEO_BYTES) return Promise.reject(new Error('סרטון יכול להיות בגודל של עד 20MB.'));
      return readFileAsDataUrl(file).then(function (dataUrl) { return { kind: 'video', dataUrl: dataUrl }; });
    }
    return Promise.reject(new Error('אפשר להוסיף תמונות PNG/JPG/WebP או סרטוני MP4/WebM.'));
  }

  function normalizeMediaFiles(fileList) {
    return Array.prototype.slice.call(fileList || []).filter(function (file) {
      return file && (/^image\/(png|jpeg|webp)$/i.test(file.type || '') || /^video\/(mp4|webm)$/i.test(file.type || ''));
    });
  }

  function addMediaFiles(fileList, sourceLabel) {
    var files = normalizeMediaFiles(fileList);
    if (!files.length) {
      setMessage('לא נמצא קובץ מתאים. אפשר להשתמש בתמונות PNG/JPG/WebP או בסרטוני MP4/WebM.', true);
      return Promise.resolve();
    }

    var remaining = MAX_MEDIA - mediaItems.length;
    if (remaining <= 0) {
      setMessage('אפשר לצרף עד ' + MAX_MEDIA + ' תמונות או סרטונים לביקורת.', true);
      return Promise.resolve();
    }

    var selected = files.slice(0, remaining);
    var omitted = files.length - selected.length;
    mediaJobs += 1;
    submit.disabled = true;
    setMessage('מכין ' + selected.length + (selected.length === 1 ? ' קובץ…' : ' קבצים…'));

    return Promise.all(selected.map(fileToMediaItem)).then(function (items) {
      items.forEach(function (item) {
        if (mediaItems.some(function (existing) { return existing.dataUrl === item.dataUrl; })) return;
        mediaSequence += 1;
        mediaItems.push({ id: mediaSequence, kind: item.kind, dataUrl: item.dataUrl, source: sourceLabel || 'file' });
      });
      renderMediaPreviews();
      if (omitted > 0) {
        setMessage('נוספו ' + selected.length + ' קבצים. אפשר לצרף עד ' + MAX_MEDIA + ' קבצים.', true);
      } else {
        setMessage(mediaItems.length === 1 ? 'הקובץ מוכן.' : mediaItems.length + ' קבצים מוכנים.', false);
      }
    }).catch(function (err) {
      setMessage(err.message || 'לא הצלחנו להכין את הקבצים.', true);
    }).then(function () {
      mediaJobs = Math.max(0, mediaJobs - 1);
      submit.disabled = mediaJobs > 0;
      if (mediaInput) mediaInput.value = '';
    });
  }

  function clipboardMediaFiles(event) {
    var data = event.clipboardData;
    if (!data) return [];
    var files = [];
    if (data.items && data.items.length) {
      Array.prototype.forEach.call(data.items, function (item) {
        if (item.kind === 'file' && (/^image\//i.test(item.type || '') || /^video\//i.test(item.type || ''))) {
          var file = item.getAsFile();
          if (file) files.push(file);
        }
      });
    }
    if (!files.length && data.files) files = normalizeMediaFiles(data.files);
    return files;
  }

  function renderDetailProduct(review) {
    var product = review && review.product ? review.product : null;
    if (!detailProduct) return;
    if (!product) {
      detailProduct.hidden = true;
      return;
    }
    detailProduct.hidden = false;
    detailProduct.href = product.href || '/mom-heart-necklace';
    detailProductImage.src = product.imageUrl || 'images/review-products/necklace-1.png';
    detailProductImage.alt = product.title || 'המוצר שנרכש';
    detailProductTitle.textContent = product.title || 'שרשרת לאמא עם ברכה והקדשה מרגשת';
    detailProductVariant.textContent = product.variantLabel || '';
    detailProductVariant.hidden = !product.variantLabel;
  }

  function renderDetailMedia() {
    if (!activeDetailReview) return;
    var items = mediaForReview(activeDetailReview);
    if (!items.length) {
      detailMedia.hidden = true;
      detailDialog.classList.add('is-no-media');
      detailStage.textContent = '';
      return;
    }

    detailDialog.classList.remove('is-no-media');
    detailMedia.hidden = false;
    activeDetailMediaIndex = Math.max(0, Math.min(activeDetailMediaIndex, items.length - 1));
    detailStage.textContent = '';
    var item = items[activeDetailMediaIndex];

    if (item.kind === 'video') {
      var video = document.createElement('video');
      video.className = 'review-detail-modal__video';
      video.src = item.url;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.autoplay = true;
      detailStage.appendChild(video);
    } else {
      var image = document.createElement('img');
      image.className = 'review-detail-modal__image';
      image.src = item.url;
      image.alt = 'תמונה מתוך הביקורת';
      detailStage.appendChild(image);
    }

    var multi = items.length > 1;
    detailPrev.hidden = !multi;
    detailNext.hidden = !multi;
    detailCounter.hidden = !multi;
    detailCounter.textContent = multi ? (activeDetailMediaIndex + 1) + ' / ' + items.length : '';
  }

  function openReviewDetail(review) {
    if (!detailModal || !review) return;
    detailLastFocused = document.activeElement;
    activeDetailReview = review;
    activeDetailMediaIndex = 0;
    detailVerified.hidden = !review.verified;
    detailDate.textContent = reviewDate(review.createdAt);
    detailDate.dateTime = new Date(review.createdAt).toISOString();
    detailStars.textContent = starsText(review.rating);
    detailScore.textContent = review.rating + ' / 5';
    detailText.textContent = review.text;
    renderDetailProduct(review);
    renderDetailMedia();
    detailModal.hidden = false;
    document.body.classList.add('review-detail-open');
    setTimeout(function () {
      var close = detailModal.querySelector('[data-review-detail-close]');
      if (close) close.focus();
    }, 0);
  }

  function closeReviewDetail() {
    if (!detailModal || detailModal.hidden) return;
    var video = detailStage && detailStage.querySelector('video');
    if (video) video.pause();
    detailModal.hidden = true;
    document.body.classList.remove('review-detail-open');
    activeDetailReview = null;
    detailStage.textContent = '';
    if (detailLastFocused && typeof detailLastFocused.focus === 'function') detailLastFocused.focus();
  }

  function moveDetailMedia(delta) {
    if (!activeDetailReview) return;
    var items = mediaForReview(activeDetailReview);
    if (items.length < 2) return;
    activeDetailMediaIndex = (activeDetailMediaIndex + delta + items.length) % items.length;
    renderDetailMedia();
  }

  starButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setRating(Number(button.getAttribute('data-review-rating')));
      setMessage('');
    });
  });

  textInput.addEventListener('input', function () {
    textCount.textContent = textInput.value.length + ' / 1200';
  });

  if (mediaInput) mediaInput.addEventListener('change', function () { addMediaFiles(mediaInput.files, 'picker'); });

  if (dropZone) {
    ['dragenter', 'dragover'].forEach(function (eventName) {
      dropZone.addEventListener(eventName, function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add('is-dragover');
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      });
    });
    ['dragleave', 'dragend'].forEach(function (eventName) {
      dropZone.addEventListener(eventName, function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('is-dragover');
      });
    });
    dropZone.addEventListener('drop', function (event) {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove('is-dragover');
      addMediaFiles(event.dataTransfer && event.dataTransfer.files, 'drop');
    });
    dropZone.addEventListener('keydown', function (event) {
      if ((event.key === 'Enter' || event.key === ' ') && mediaInput) {
        event.preventDefault();
        mediaInput.click();
      }
    });
  }

  modal.addEventListener('paste', function (event) {
    if (modal.hidden || form.hidden) return;
    var files = clipboardMediaFiles(event);
    if (!files.length) return;
    event.preventDefault();
    addMediaFiles(files, 'paste');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setMessage('');
    var phone = phoneInput.value.trim();
    var reviewDateValue = dateInput ? dateInput.value : '';
    var text = textInput.value.trim();

    if (phone.replace(/\D/g, '').length < 9) {
      setMessage('הזינו מספר טלפון תקין.', true);
      phoneInput.focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewDateValue) || reviewDateValue > localDateValue(new Date())) {
      setMessage('בחרו תאריך ביקורת תקין שאינו בעתיד.', true);
      if (dateInput) dateInput.focus();
      return;
    }
    if (!selectedRating) {
      setMessage('בחרו דירוג של 1 עד 5 כוכבים.', true);
      starButtons[0].focus();
      return;
    }
    if (text.length < 3) {
      setMessage('כתבו לפחות כמה מילים על החוויה שלכם.', true);
      textInput.focus();
      return;
    }
    if (mediaJobs > 0) {
      setMessage('חכו רגע עד שכל התמונות והסרטונים יסיימו להיטען.', true);
      return;
    }

    submit.disabled = true;
    submit.textContent = 'מפרסם…';
    fetch('/api/reviews', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        phone: phone,
        date: reviewDateValue,
        rating: selectedRating,
        text: text,
        media: mediaItems.map(function (item) { return { kind: item.kind, dataUrl: item.dataUrl }; })
      })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) { return { response: response, data: data }; });
    }).then(function (result) {
      if (result.response.status === 401) {
        currentUser = null;
        updateModalMode();
        throw new Error('כדי לפרסם ביקורת צריך להתחבר שוב.');
      }
      if (!result.response.ok || !result.data.ok) {
        var code = result.data && result.data.error;
        if (code === 'verified_customer_required') {
          if (currentUser) currentUser.isVerifiedCustomer = false;
          updateModalMode();
          throw new Error('רק לקוחות עם רכישה מאומתת יכולים לפרסם ביקורת.');
        }
        if (code === 'invalid_phone') throw new Error('הזינו מספר טלפון תקין.');
        if (code === 'invalid_review_date') throw new Error('בחרו תאריך ביקורת תקין שאינו בעתיד.');
        if (code === 'too_many_media') throw new Error('אפשר לצרף עד ' + MAX_MEDIA + ' תמונות או סרטונים לביקורת.');
        if (code === 'media_too_large' || code === 'video_too_large' || code === 'image_too_large') throw new Error('אחד הקבצים גדול מדי. נסו קובץ קטן יותר.');
        if (code === 'invalid_media') throw new Error('קובץ המדיה אינו נתמך או אינו תקין.');
        if (code === 'too_many_attempts') throw new Error('נשלחו יותר מדי ביקורות בזמן קצר. נסו שוב מאוחר יותר.');
        throw new Error('לא הצלחנו לפרסם את הביקורת. נסו שוב.');
      }
      return loadReviews(true).then(function () {
        closeModal();
        resetForm();
        document.getElementById('reviews').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }).catch(function (err) {
      submit.disabled = false;
      submit.textContent = 'פרסום הביקורת';
      setMessage(err.message || 'לא הצלחנו לפרסם את הביקורת.', true);
    });
  });

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var rating = Number(button.getAttribute('data-reviews-rating') || 0);
      if (!Number.isInteger(rating) || rating < 0 || rating > 5 || rating === activeRatingFilter) return;
      activeRatingFilter = rating;
      filterButtons.forEach(function (candidate) {
        var isActive = Number(candidate.getAttribute('data-reviews-rating') || 0) === activeRatingFilter;
        candidate.classList.toggle('is-active', isActive);
        candidate.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      loadReviews(true);
    });
  });

  openBtn.addEventListener('click', function () { loadUser().then(openModal); });
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { loadReviews(false); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-review-close]'), function (button) {
    button.addEventListener('click', closeModal);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-review-detail-close]'), function (button) {
    button.addEventListener('click', closeReviewDetail);
  });

  if (detailPrev) detailPrev.addEventListener('click', function () { moveDetailMedia(-1); });
  if (detailNext) detailNext.addEventListener('click', function () { moveDetailMedia(1); });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (detailModal && !detailModal.hidden) closeReviewDetail();
      else if (!modal.hidden) closeModal();
    }
    if (detailModal && !detailModal.hidden && activeDetailReview) {
      if (event.key === 'ArrowLeft') moveDetailMedia(-1);
      if (event.key === 'ArrowRight') moveDetailMedia(1);
    }
  });

  Promise.all([loadReviews(true), loadUser()]);
}());
