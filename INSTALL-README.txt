VerSans — Professional Sitemap INDEX (2026-11-25)
================================================

WHAT CHANGED
/sitemap.xml now displays a SMALL XML sitemap index containing only:
  https://versans.com/sitemap_products_1.xml
  https://versans.com/sitemap_collections_1.xml
  https://versans.com/sitemap_pages_1.xml

Every child sitemap is generated dynamically from the live PUBLIC catalog.
The product URLs are NOT deleted from Google's discovery feed; they are placed
in the products child map. It keeps updating when a product/category is hidden,
shown, added or changed in PostgreSQL.

FILES TO COPY into the COMPLETE project (replace files at these paths):
  server.js
  lib/seo.js
  sitemap.xml
  sitemap_products_1.xml
  sitemap_collections_1.xml
  sitemap_pages_1.xml

DO NOT deploy the ZIP as a standalone site. Merge only these paths into the
existing full VerSans project, and deploy the full project to Render as usual.
No terminal commands and no PostgreSQL migration are needed.

IMPORTANT ABOUT SERVER.JS
The new child XML endpoints require a tiny server change (13 added/4 removed
lines) so the child XML documents can be generated from PostgreSQL in real time.
This package includes the entire server.js for direct replacement, based on the
latest available 2026-11-25 sitemap-project snapshot. If your local server.js
has been changed since that snapshot, DO NOT blindly overwrite it: merge only
the changes shown in REVIEW-server.diff instead to preserve newer fixes.

The sitemap*.xml documents in this ZIP are safe STATIC FALLBACK snapshots.
When hosted on Render, server.js and lib/seo.js override them with LIVE
PostgreSQL-powered XML. Static fallback content can differ from live catalog.

CHECKS AFTER RENDER DEPLOY
  1) https://versans.com/sitemap.xml
       <sitemapindex> with 3 entries; not a long <urlset>.
  2) Open all 3 child links; each must return HTTP 200 and XML, not HTML/404.
  3) Verify hidden products/categories are not listed and current public
     products are present in sitemap_products_1.xml.
  4) Send ONLY https://versans.com/sitemap.xml to Google Search Console.

robots.txt already references /sitemap.xml and does not need editing.
No priority/changefreq tags; lastmod only when a real product update date exists.

TEST RESULTS
- 7 unit tests passed.
- XML parser validated all 4 snapshot files without duplicate URLs.
- Local HTTP server returned 200 application/xml for main and all 3 children.
- HEAD requests returned 200 for all 3 child XML endpoints.
- Current local DB test showed 254 products, 13 collection URLs and 6 pages;
  production values will depend on live PostgreSQL and category visibility.

Not deployed to the live website.
