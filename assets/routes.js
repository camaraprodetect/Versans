/* Public URL helpers shared by the browser and Node server. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VERSANS_ROUTES = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLLECTION_PATHS = {
    all: '/',
    greeting: '/message-jewelry',
    'greeting-mom': '/gifts-for-mom',
    'greeting-partner': '/gifts-for-partner',
    'greeting-daughter': '/gifts-for-daughter',
    'greeting-sister': '/gifts-for-sister',
    necklaces: '/necklaces',
    bracelets: '/bracelets',
    'photo-bracelets': '/photo-bracelets',
    watches: '/watches',
    glasses: '/glasses',
    'glasses-men': '/glasses-men',
    'glasses-women': '/glasses-women',
    'glasses-unisex': '/glasses-unisex',
    'gift-boxes': '/gift-sets',
    custom: '/personal-design',
    sets: '/sets'
  };

  var PAGE_FILES = {
    '/policies': 'policies.html',
    '/login': 'login.html',
    '/register': 'register.html',
    '/account': 'account.html',
    '/thank-you': 'thank-you.html',
    '/greeting-editor': 'greeting-editor.html',
    '/choose-necklace': 'necklaces.html'
  };

  var CATEGORY_BY_PATH = {};
  Object.keys(COLLECTION_PATHS).forEach(function (category) {
    CATEGORY_BY_PATH[COLLECTION_PATHS[category]] = category;
  });

  var LEGACY_PAGE_PATHS = { '/index.html': '/' };
  Object.keys(PAGE_FILES).forEach(function (prettyPath) {
    LEGACY_PAGE_PATHS['/' + PAGE_FILES[prettyPath]] = prettyPath;
  });

  function collectionPath(category) {
    return COLLECTION_PATHS[category] || '/';
  }

  function categoryFromPath(pathname) {
    return CATEGORY_BY_PATH[pathname || '/'] || null;
  }

  function productPath(product) {
    if (!product || !product.urlSlug) return '/';
    return '/' + encodeURIComponent(product.urlSlug);
  }

  function pagePath(name) {
    var names = {
      policies: '/policies', login: '/login', register: '/register', account: '/account',
      thankYou: '/thank-you', greetingEditor: '/greeting-editor', chooseNecklace: '/choose-necklace'
    };
    return names[name] || '/';
  }

  return {
    COLLECTION_PATHS: COLLECTION_PATHS,
    CATEGORY_BY_PATH: CATEGORY_BY_PATH,
    PAGE_FILES: PAGE_FILES,
    LEGACY_PAGE_PATHS: LEGACY_PAGE_PATHS,
    collectionPath: collectionPath,
    categoryFromPath: categoryFromPath,
    productPath: productPath,
    pagePath: pagePath
  };
});
