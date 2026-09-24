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
  var productPicker = document.getElementById('reviewProducts');
  var nameInput = document.getElementById('reviewName');
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
  var myReviewsBtn = document.getElementById('openMyReviews');
  var myReviewsModal = document.getElementById('myReviewsModal');
  var myReviewsLoading = document.getElementById('myReviewsLoading');
  var myReviewsEmpty = document.getElementById('myReviewsEmpty');
  var myReviewsList = document.getElementById('myReviewsList');
  var myReviewsMessage = document.getElementById('myReviewsMessage');
  var myReviewsLastFocused = null;

  var detailModal = document.getElementById('reviewDetailModal');
  var detailDialog = document.getElementById('reviewDetailDialog');
  var detailMedia = document.getElementById('reviewDetailMedia');
  var detailStage = document.getElementById('reviewDetailStage');
  var detailPrev = document.getElementById('reviewDetailPrev');
  var detailNext = document.getElementById('reviewDetailNext');
  var detailCounter = document.getElementById('reviewDetailCounter');
  var detailName = document.getElementById('reviewDetailName');
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
  var eligibleReviewProducts = [];
  var eligibleProductsLoaded = false;
  var eligibleProductsLoadError = false;
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

  function displayReviewName(review) {
    var name = String(review && review.name ? review.name : '').replace(/\s+/g, ' ').trim();
    return name && name !== 'לקוח VerSans' ? name : 'לקוח';
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
    var products = review && Array.isArray(review.products) ? review.products : (product ? [product] : []);
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
      var extra = products.length > 1 ? '+' + (products.length - 1) + ' מוצרים נוספים' : '';
      variant.textContent = [product.variantLabel || '', extra].filter(Boolean).join(' · ');
      variant.hidden = !variant.textContent;
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
    name.textContent = displayReviewName(review);
    if (verified) verified.hidden = false;
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

  function updateVerifiedActions() {
    if (myReviewsBtn) myReviewsBtn.hidden = !(currentUser && currentUser.isVerifiedCustomer);
  }

  function loadUser() {
    return fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) { currentUser = data && data.user ? data.user : null; updateVerifiedActions(); })
      .catch(function () { currentUser = null; updateVerifiedActions(); });
  }

  function renderEligibleReviewProducts() {
    if (!productPicker) return;
    productPicker.textContent = '';

    function status(text, isError) {
      var el = document.createElement('div');
      el.className = 'review-product-picker__status' + (isError ? ' is-error' : '');
      el.textContent = text;
      productPicker.appendChild(el);
    }

    if (!eligibleProductsLoaded) {
      status('טוען את המוצרים שרכשתם…');
      return;
    }
    if (eligibleProductsLoadError) {
      status('לא הצלחנו לטעון את הרכישות.', true);
      return;
    }
    if (!eligibleReviewProducts.length) {
      status('לא נמצאו מוצרים שנרכשו.');
      return;
    }

    eligibleReviewProducts.forEach(function (product, index) {
      var label = document.createElement('label');
      label.className = 'review-product-option';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'reviewProducts';
      checkbox.value = String(product.id || '');
      checkbox.setAttribute('aria-label', String(product.title || 'המוצר שנרכש'));
      checkbox.addEventListener('change', function () {
        label.classList.toggle('is-selected', checkbox.checked);
        setMessage('');
      });

      var image = document.createElement('img');
      image.className = 'review-product-option__image';
      image.src = product.imageUrl || '/images/review-products/necklace-1.png';
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';

      var copy = document.createElement('span');
      copy.className = 'review-product-option__copy';
      var title = document.createElement('strong');
      title.textContent = String(product.title || 'המוצר שנרכש');
      copy.appendChild(title);
      if (product.variantLabel) {
        var variant = document.createElement('small');
        variant.textContent = product.variantLabel;
        copy.appendChild(variant);
      }

      var mark = document.createElement('span');
      mark.className = 'review-product-option__mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '✓';

      label.appendChild(checkbox);
      label.appendChild(image);
      label.appendChild(copy);
      label.appendChild(mark);
      productPicker.appendChild(label);
      if (index === 0) label.dataset.firstProduct = 'true';
    });
  }

  function selectedReviewProductIds() {
    if (!productPicker) return [];
    return Array.prototype.slice.call(productPicker.querySelectorAll('input[type="checkbox"]:checked'))
      .map(function (input) { return String(input.value || '').trim(); })
      .filter(Boolean);
  }

  function loadEligibleReviewProducts() {
    eligibleReviewProducts = [];
    eligibleProductsLoaded = false;
    eligibleProductsLoadError = false;
    renderEligibleReviewProducts();
    if (!currentUser) {
      eligibleProductsLoaded = true;
      renderEligibleReviewProducts();
      return Promise.resolve();
    }

    return fetch('/api/reviews/eligible-products', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (response.status === 401) {
        currentUser = null;
        return null;
      }
      if (!response.ok) throw new Error('eligible_products_load_failed');
      return response.json();
    }).then(function (payload) {
      eligibleReviewProducts = payload && Array.isArray(payload.products) ? payload.products : [];
      eligibleProductsLoaded = true;
      renderEligibleReviewProducts();
    }).catch(function () {
      eligibleReviewProducts = [];
      eligibleProductsLoaded = true;
      eligibleProductsLoadError = true;
      renderEligibleReviewProducts();
    });
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
    if (productPicker) {
      Array.prototype.forEach.call(productPicker.querySelectorAll('input[type="checkbox"]'), function (input) {
        input.checked = false;
        var option = input.closest('.review-product-option');
        if (option) option.classList.remove('is-selected');
      });
    }
    if (nameInput) nameInput.value = currentUser && currentUser.name ? currentUser.name : '';
    if (phoneInput) phoneInput.value = currentUser && currentUser.phone ? currentUser.phone : '';
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
    updateVerifiedActions();
    var loggedIn = !!currentUser;
    var verified = loggedIn && !!currentUser.isVerifiedCustomer;
    var hasPurchasedProducts = eligibleProductsLoaded && !eligibleProductsLoadError && eligibleReviewProducts.length > 0;
    var canReview = verified && hasPurchasedProducts;
    form.hidden = !canReview;
    loginRequired.hidden = loggedIn;
    verifiedRequired.hidden = !loggedIn || canReview;

    if (canReview) {
      userLine.textContent = 'לקוח מאומת · אפשר לכתוב ביקורת רק על מוצר שרכשתם.';
    } else if (loggedIn && verifiedRequired) {
      var title = verifiedRequired.querySelector('strong');
      var copy = verifiedRequired.querySelector('p');
      if (eligibleProductsLoadError) {
        if (title) title.textContent = 'לא הצלחנו לבדוק את הרכישות כרגע';
        if (copy) copy.textContent = 'רעננו את העמוד ונסו שוב. הביקורת תתאפשר רק לאחר שנזהה מוצר שנרכש בחשבון.';
      } else if (verified && eligibleProductsLoaded) {
        if (title) title.textContent = 'לא נמצאו מוצרים זמינים לביקורת';
        if (copy) copy.textContent = 'אפשר לפרסם ביקורת רק על מוצרים שמופיעים בהזמנה ששולמה ומקושרת לחשבון הזה.';
      } else {
        if (title) title.textContent = 'ביקורות זמינות ללקוחות מאומתים בלבד';
        if (copy) copy.textContent = 'רק חשבון שמקושר לרכישה שאושרה יכול לפרסם ביקורת. אפשר עדיין לקרוא את כל הביקורות באתר.';
      }
    }
  }

  function openModal() {
    lastFocused = document.activeElement;
    resetForm();
    updateModalMode();
    modal.hidden = false;
    document.body.classList.add('review-modal-open');
    var canReview = !!currentUser && !!currentUser.isVerifiedCustomer && eligibleProductsLoaded && !eligibleProductsLoadError && eligibleReviewProducts.length > 0;
    var firstProductChoice = productPicker ? productPicker.querySelector('input[type="checkbox"]') : null;
    var focusTarget = currentUser
      ? (canReview ? (firstProductChoice || phoneInput) : verifiedRequired.querySelector('a,button'))
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
    var products = review && Array.isArray(review.products) ? review.products : (product ? [product] : []);
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
    var extra = products.length > 1 ? '+' + (products.length - 1) + ' מוצרים נוספים בביקורת' : '';
    detailProductVariant.textContent = [product.variantLabel || '', extra].filter(Boolean).join(' · ');
    detailProductVariant.hidden = !detailProductVariant.textContent;
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
    if (detailName) detailName.textContent = displayReviewName(review);
    detailVerified.hidden = false;
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

  function setMyReviewsMessage(text, isError) {
    if (!myReviewsMessage) return;
    myReviewsMessage.textContent = text || '';
    myReviewsMessage.classList.toggle('is-error', !!text && !!isError);
  }

  function reviewProductsForDisplay(review) {
    if (review && Array.isArray(review.products) && review.products.length) return review.products;
    return review && review.product ? [review.product] : [];
  }

  function renderMyReviews(reviews) {
    if (!myReviewsList || !myReviewsEmpty || !myReviewsLoading) return;
    myReviewsLoading.hidden = true;
    myReviewsList.textContent = '';
    reviews = Array.isArray(reviews) ? reviews : [];
    if (!reviews.length) {
      myReviewsEmpty.hidden = false;
      myReviewsList.hidden = true;
      return;
    }
    myReviewsEmpty.hidden = true;
    myReviewsList.hidden = false;

    reviews.forEach(function (review) {
      var card = document.createElement('article');
      card.className = 'my-review-card';
      card.dataset.reviewId = String(review.id);

      var top = document.createElement('div');
      top.className = 'my-review-card__top';
      var identity = document.createElement('div');
      identity.className = 'my-review-card__identity';
      var reviewerName = document.createElement('strong');
      reviewerName.className = 'my-review-card__name';
      reviewerName.textContent = displayReviewName(review);
      var reviewerVerified = document.createElement('span');
      reviewerVerified.className = 'my-review-card__verified';
      reviewerVerified.innerHTML = '<span aria-hidden="true">V</span> לקוח מאומת';
      identity.appendChild(reviewerName);
      identity.appendChild(reviewerVerified);
      var rating = document.createElement('div');
      rating.className = 'my-review-card__rating';
      rating.textContent = starsText(Number(review.rating || 0));
      var date = document.createElement('time');
      date.className = 'my-review-card__date';
      date.textContent = reviewDate(review.createdAt);
      try { date.dateTime = new Date(review.createdAt).toISOString(); } catch (_) {}
      top.appendChild(identity);
      top.appendChild(rating);
      top.appendChild(date);

      var body = document.createElement('p');
      body.className = 'my-review-card__text';
      body.textContent = review.text || '';

      var productsWrap = document.createElement('div');
      productsWrap.className = 'my-review-card__products';
      reviewProductsForDisplay(review).forEach(function (product) {
        var chip = document.createElement('span');
        chip.className = 'my-review-card__product';
        var img = document.createElement('img');
        img.src = product.imageUrl || '/images/review-products/necklace-1.png';
        img.alt = '';
        img.loading = 'lazy';
        var copy = document.createElement('span');
        copy.textContent = product.title || 'המוצר שנרכש';
        chip.appendChild(img);
        chip.appendChild(copy);
        productsWrap.appendChild(chip);
      });

      var actions = document.createElement('div');
      actions.className = 'my-review-card__actions';
      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'my-review-card__delete';
      deleteBtn.textContent = 'מחיקת הביקורת';
      deleteBtn.addEventListener('click', function () { deleteMyReview(review, deleteBtn); });
      actions.appendChild(deleteBtn);

      card.appendChild(top);
      card.appendChild(body);
      if (productsWrap.childNodes.length) card.appendChild(productsWrap);
      card.appendChild(actions);
      myReviewsList.appendChild(card);
    });
  }

  function loadMyReviews() {
    if (!myReviewsModal) return Promise.resolve();
    if (myReviewsLoading) { myReviewsLoading.hidden = false; myReviewsLoading.textContent = 'טוען את הביקורות שלכם…'; }
    if (myReviewsEmpty) myReviewsEmpty.hidden = true;
    if (myReviewsList) myReviewsList.hidden = true;
    setMyReviewsMessage('');
    return fetch('/api/reviews/mine', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) { return { response: response, data: data }; });
      })
      .then(function (result) {
        if (result.response.status === 401 || result.response.status === 403) {
          if (result.response.status === 401) currentUser = null;
          else if (currentUser) currentUser.isVerifiedCustomer = false;
          updateVerifiedActions();
          throw new Error('האזור זמין ללקוחות מאומתים בלבד.');
        }
        if (!result.response.ok || !result.data.ok) throw new Error('לא הצלחנו לטעון את הביקורות שלכם.');
        renderMyReviews(result.data.reviews || []);
      })
      .catch(function (err) {
        if (myReviewsLoading) { myReviewsLoading.hidden = false; myReviewsLoading.textContent = err.message || 'לא הצלחנו לטעון את הביקורות שלכם.'; }
      });
  }

  function openMyReviews() {
    if (!myReviewsModal || !currentUser || !currentUser.isVerifiedCustomer) return;
    myReviewsLastFocused = document.activeElement;
    myReviewsModal.hidden = false;
    document.body.classList.add('review-modal-open');
    loadMyReviews();
    setTimeout(function () {
      var close = myReviewsModal.querySelector('[data-my-reviews-close]');
      if (close) close.focus();
    }, 0);
  }

  function closeMyReviews() {
    if (!myReviewsModal || myReviewsModal.hidden) return;
    myReviewsModal.hidden = true;
    document.body.classList.remove('review-modal-open');
    if (myReviewsLastFocused && typeof myReviewsLastFocused.focus === 'function') myReviewsLastFocused.focus();
  }

  function deleteMyReview(review, button) {
    if (!review || !review.id) return;
    if (!window.confirm('למחוק את הביקורת הזאת? הפעולה לא ניתנת לביטול.')) return;
    setMyReviewsMessage('');
    if (button) { button.disabled = true; button.textContent = 'מוחק…'; }
    fetch('/api/reviews/' + encodeURIComponent(review.id), {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) { return { response: response, data: data }; });
    }).then(function (result) {
      if (!result.response.ok || !result.data.ok) {
        if (result.response.status === 401 || result.response.status === 403) {
          if (result.response.status === 401) currentUser = null;
          else if (currentUser) currentUser.isVerifiedCustomer = false;
          updateVerifiedActions();
          throw new Error('האזור זמין ללקוחות מאומתים בלבד.');
        }
        throw new Error('לא הצלחנו למחוק את הביקורת. נסו שוב.');
      }
      setMyReviewsMessage('הביקורת נמחקה.');
      return Promise.all([loadMyReviews(), loadReviews(true)]);
    }).catch(function (err) {
      if (button) { button.disabled = false; button.textContent = 'מחיקת הביקורת'; }
      setMyReviewsMessage(err.message || 'לא הצלחנו למחוק את הביקורת.', true);
    });
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
    var productIds = selectedReviewProductIds();
    var reviewName = nameInput ? nameInput.value.replace(/\s+/g, ' ').trim() : '';
    var phone = phoneInput.value.trim();
    var reviewDateValue = dateInput ? dateInput.value : '';
    var text = textInput.value.trim();

    if (!productIds.length) {
      setMessage('חייבים לבחור לפחות מוצר אחד שרכשתם.', true);
      var firstProductChoice = productPicker ? productPicker.querySelector('input[type="checkbox"]') : null;
      if (firstProductChoice) firstProductChoice.focus();
      return;
    }
    if (reviewName.length < 2 || reviewName.length > 70) {
      setMessage('הזינו שם שיוצג בביקורת (2 עד 70 תווים).', true);
      if (nameInput) nameInput.focus();
      return;
    }
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
        productIds: productIds,
        name: reviewName,
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
        if (code === 'product_not_purchased') throw new Error('אפשר לפרסם ביקורת רק על מוצר שנרכש בחשבון הזה.');
        if (code === 'invalid_review_name') throw new Error('הזינו שם שיוצג בביקורת (2 עד 70 תווים).');
        if (code === 'review_product_required') throw new Error('חייבים לבחור לפחות מוצר אחד שרכשתם לפני פרסום הביקורת.');
        if (code === 'too_many_review_products') throw new Error('נבחרו יותר מדי מוצרים לביקורת אחת.');
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

  openBtn.addEventListener('click', function () {
    loadUser()
      .then(function () { return loadEligibleReviewProducts(); })
      .then(openModal);
  });
  if (myReviewsBtn) {
    myReviewsBtn.addEventListener('click', function () {
      loadUser().then(function () {
        if (currentUser && currentUser.isVerifiedCustomer) openMyReviews();
      });
    });
  }
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { loadReviews(false); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-review-close]'), function (button) {
    button.addEventListener('click', closeModal);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-my-reviews-close]'), function (button) {
    button.addEventListener('click', closeMyReviews);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-review-detail-close]'), function (button) {
    button.addEventListener('click', closeReviewDetail);
  });

  if (detailPrev) detailPrev.addEventListener('click', function () { moveDetailMedia(-1); });
  if (detailNext) detailNext.addEventListener('click', function () { moveDetailMedia(1); });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (detailModal && !detailModal.hidden) closeReviewDetail();
      else if (myReviewsModal && !myReviewsModal.hidden) closeMyReviews();
      else if (!modal.hidden) closeModal();
    }
    if (detailModal && !detailModal.hidden && activeDetailReview) {
      if (event.key === 'ArrowLeft') moveDetailMedia(-1);
      if (event.key === 'ArrowRight') moveDetailMedia(1);
    }
  });

  Promise.all([loadReviews(true), loadUser()]);
}());
