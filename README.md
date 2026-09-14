# VerSans - חנות עם Login / Register / Logout ב-SQLite

הפרויקט כולל את החנות, סליקת HYP, עורך הברכות ומערכת חשבונות אמיתית עם SQLite.

## מערכת החשבונות

נוספו:

- `register.html` - יצירת חשבון
- `login.html` - התחברות
- `account.html` - פרטי החשבון + Logout
- `server.js` - שרת Node שמגיש את האתר, מטפל ב-auth ובנתיבי הסליקה
- `data/versans.sqlite` - נוצר אוטומטית בהרצה הראשונה
- `assets/auth.js`, `assets/auth.css`, `assets/auth-nav.js`

האבטחה כוללת:

- הסיסמאות נשמרות כ-`scrypt` hash עם salt - לא כטקסט גלוי.
- Session אקראי נשמר ב-SQLite והדפדפן מקבל Cookie מסוג `HttpOnly` + `SameSite=Lax`.
- ב-production/HTTPS העוגייה מסומנת גם `Secure`.
- Logout מוחק את ה-session מהמסד וגם את ה-cookie.
- קיימת הגבלת ניסיונות בסיסית על Login/Register.
- SQLite עובד עם `WAL`, `foreign_keys` ו-`busy_timeout`.

## הרצה מקומית

נדרש Node.js 22.5 ומעלה.

```bash
npm start
```

ואז פותחים:

```text
http://localhost:3000
```

אין צורך ב-`npm install`, כי מערכת ה-SQLite משתמשת במודול `node:sqlite` המובנה ב-Node 22.

> חשוב: אחרי הוספת Login אי אפשר לבדוק את האתר רק על ידי פתיחת `index.html` עם `file://`. צריך להריץ `npm start` כדי שה-API וה-SQLite יעבדו.

## איפה נשמר ה-SQLite

ברירת מחדל:

```text
data/versans.sqlite
```

אפשר לבחור מיקום אחר בעזרת אחד ממשתני הסביבה:

```text
VERSANS_DATA_DIR=/data
```

או:

```text
VERSANS_DB_PATH=/data/versans.sqlite
```

זה שימושי במיוחד בהעלאה לשרת עם Persistent Disk.

## העלאה לאוויר - חשוב

SQLite כקובץ מקומי צריך שרת עם דיסק קבוע. לכן לגרסה הזאת מומלץ להשתמש בשרת Node/VPS או שירות שמאפשר **Persistent Disk / Volume**.

**לא מומלץ לפרוס את מערכת החשבונות הזאת כמו שהיא ל-Vercel Functions או Netlify Functions**, כי מערכת הקבצים של serverless אינה דיסק קבוע למסד SQLite מקומי. אם משתמשים בשירות כזה צריך לעבור למסד חיצוני/SQLite בענן.

בשרת רגיל:

1. העלו את התיקייה.
2. ודאו שיש Node 22.5+.
3. הגדירו את משתני HYP (`HYP_MASOF`, `HYP_API_KEY`, `HYP_PASSP`).
4. הגדירו `NODE_ENV=production`.
5. אם יש volume קבוע, הגדירו למשל `VERSANS_DATA_DIR=/data`.
6. הפעילו `npm start`.
7. חברו HTTPS דרך ספק האחסון / reverse proxy.

## API של החשבונות

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

הדפדפן משתמש בהם אוטומטית דרך דפי החשבון.

## סליקת HYP

הנתיבים הקיימים נשמרו גם בשרת החדש:

```text
POST /api/create-payment
GET  /api/verify-payment
```

מפתחות HYP נשארים רק במשתני הסביבה ולא נכתבים בקוד.

## ברכות אישיות

שמירת PNG דרך Google Apps Script נשארה כפי שהייתה. ההגדרה נמצאת ב-`assets/config.js` תחת `greetingStorage.appsScriptUrl`.

## ביקורות לקוחות - לקוחות מאומתים בלבד

עמוד הבית כולל מערכת ביקורות שמחוברת ל-SQLite:

- כל ביקורת מוצגת בשם הקבוע **"לקוח VerSans"**. אין שדה שם ציבורי בטופס.
- רק חשבון שמסומן במסד כ-`is_verified_customer=1` יכול לפרסם ביקורת.
- חשבון נהיה לקוח מאומת רק לאחר שתשלום HYP של הזמנה מקושרת אליו חוזר כמאושר.
- אם התשלום בוצע כשהמשתמש מחובר, ההזמנה נקשרת ישירות לחשבון. אם המשתמש לא מחובר אבל כבר קיים חשבון עם כתובת האימייל שנמסרה בצ'קאאוט, ההזמנה יכולה להיקשר אליו.
- ביקורות חדשות של לקוחות מאומתים נשמרות עם `verified_purchase=1` ומוצגות עם תג **מאומת**.
- ביקורות היסטוריות שלא קיים להן תיעוד רכישה מאושר אינן מקבלות תג מאומת.
- פרסום ביקורת מחייב מספר טלפון. המספר נשמר רק בשדה הפרטי `reviews.contact_phone` ואינו מוחזר ב-API הציבורי ואינו מוצג באתר.
- אפשר לבחור 1–5 כוכבים, לכתוב ביקורת, לבחור כרגע תאריך ידנית ולהוסיף עד 5 תמונות.
- אפשר לבחור כמה קבצים, לגרור תמונות או להדביק עם `Ctrl+V`.
- כל התמונות נשמרות בתוך SQLite בטבלת `review_images` כ-BLOB.
- כפתור עריכת ביקורת הוסר ו-`PUT /api/reviews/:id` אינו פעיל ללקוחות.

טבלת `orders` שומרת הפניה להזמנה, סכום, חשבון מקושר וסטטוס (`pending` / `paid` / `failed`). לאחר אימות תשלום מוצלח, `users.is_verified_customer` מתעדכן במסד.

API:

```text
GET  /api/reviews
POST /api/reviews
GET  /api/reviews/:id/images/:index
GET  /api/reviews/:id/image   # תאימות לתמונה הראשונה
```

## מעבר עתידי מ-SQLite למסד אחר בלי לאבד נתונים

המעבר עצמו לא יכול להיות "אוטומטי" עד שנבחר את מסד היעד (למשל PostgreSQL), אבל הפרויקט כבר בנוי כך שהמידע הקיים ניתן להעברה מלאה.

לפני מעבר מסד אפשר ליצור גיבוי רגיל:

```bash
npm run data:backup
```

וליצור Export נייד לצורך Migration:

```bash
npm run data:export
```

ה-Export כולל:

- משתמשים ומזהי המשתמשים
- password hashes (לא סיסמאות גלויות)
- כל ההזמנות וסטטוסי האימות שלהן
- כל הביקורות
- מספרי הטלפון הפרטיים שנמסרו עם ביקורות
- דירוגים וטקסט
- כל תמונות הביקורות ב-Base64 ובסדר התצוגה שלהן
- timestamps וסטטוס פרסום

הקבצים נוצרים תחת `data/exports/` ו-`data/backups/` ומוגדרים ב-`.gitignore` כי הם פרטיים. כאשר נבחר מסד היעד, נכתוב importer עבורו, נייבא את ה-Export, נוודא שספירת המשתמשים/ביקורות זהה ורק אז נעבור אליו. כך לא מוחקים את SQLite לפני שהנתונים אומתו במסד החדש.

## Reviews v10
- Reviews are loaded in batches of 12. The “הצג עוד ביקורות” button loads the next batch without reloading the page.
- Clicking a review opens a large review viewer. Reviews with multiple media items have previous/next navigation.
- Review attachments support up to 5 combined images/videos. Images: PNG/JPG/WebP. Videos: MP4/WebM, up to 20MB per video and 30MB total media per review.
- Review video BLOBs are stored in SQLite together with media MIME/type metadata and are included in `npm run data:export` for future database migration.

## Render PostgreSQL migration

Production can use Render PostgreSQL by setting `DATABASE_URL`. Without it, VerSans keeps using the local SQLite file at `data/versans.sqlite` (or `VERSANS_DB_PATH`).

### Safe migration flow

1. Keep a copy of `data/versans.sqlite`. Do not delete it.
2. Create a Render Postgres database in the same region as the VerSans web service.
3. Install dependencies with `npm install`.
4. For a migration launched from your own computer, temporarily set `DATABASE_URL` to Render's **External Database URL** and run:
   `npm run db:migrate:postgres`
5. The migration preserves explicit IDs and review BLOB bytes, resets PostgreSQL identity sequences, then compares counts and SHA-256 digests for `users`, `sessions`, `orders`, `reviews`, `review_images`, and `schema_meta`. A mismatch exits with an error.
6. Run `npm run db:verify:postgres` with the same external URL to re-check without copying.
7. In the Render web service Environment page, set `DATABASE_URL` to the database's **Internal Database URL** (same region).
8. Deploy. The server log should print `Database backend: postgres`.
9. Run/inspect the site: login, reviews, review images/videos, and checkout/order verification.

### Rollback

Remove `DATABASE_URL` from the web service and redeploy to make the server use SQLite again. Keep the original SQLite file until PostgreSQL has been verified in production.

### Greeting assets

The custom greeting editor's PNG upload is currently a separate Google Drive/IndexedDB storage flow and is not stored in `versans.sqlite`; this PostgreSQL migration therefore does not move those Drive files. It does move every record that actually exists in the SQLite database, including all review media BLOBs.
