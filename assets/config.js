/* ============================================================================
   הגדרות החנות
   ----------------------------------------------------------------------------
   זה הקובץ היחיד שצריך לגעת בו כדי לשנות שם עסק, מטבע, מחירי משלוח ופרטי קשר.
   כל שינוי כאן משפיע גם על האתר וגם על חישוב הסכום בשרת התשלום.
   ============================================================================ */

var STORE_CONFIG = {

  /* --- מיתוג ------------------------------------------------------------- */
  brand: {
    name:     { he: 'VerSans',  en: 'VerSans' },
    tagline:  { he: 'תכשיט אחד. מסר שנשאר.', en: 'One piece. A message that stays.' }
  },

  /* --- מטבע --------------------------------------------------------------
     USD  ->  code: 'USD', symbol: '$',  hypCoin: 2
     ILS  ->  code: 'ILS', symbol: '₪',  hypCoin: 1
     שימו לב: חיוב במט"ח מחייב אישור של חברת האשראי מול HYP.            */
  currency: { code: 'ILS', symbol: '₪', hypCoin: 1 },

  /* --- משלוח -------------------------------------------------------------
     flat     = דמי משלוח קבועים
     freeOver = סף למשלוח חינם (0 = משלוח חינם בכל הזמנה)               */
  shipping: {
    flat: 0,
    freeOver: 0,
    etaDays: { he: '9–14 ימי עסקים', en: '9–14 business days' }
  },

  /* --- פרטי קשר (מופיעים בפוטר, בתקנון ובדף התודה) --------------------- */
  contact: {
    email:     'versanssupport@gmail.com',
    phone:     '055-302-6389',
    whatsapp:  '972553026389',             // 055-302-6389
    instagram: '',                       // כתובת מלאה
    tiktok:    ''
  },

  /* --- פרטי העסק (חובה חוקית בתקנון) ------------------------------------ */
  business: {
    legalName: 'VerSans',
    regNumber: '',                       // יש למלא מספר עוסק/ח.פ אמיתי לפני הצגה לציבור
    address:   'ישראל'
  },

  /* --- הגדרות דף הסליקה של HYP ------------------------------------------ */
  hyp: {
    pageLang:  { he: 'HEB', en: 'ENG' }, // שפת דף התשלום
    template:  '1',                      // מספר תבנית העיצוב בממשק HYP
    sendCustomerEmail: true,             // HYP ישלח ללקוח מייל אישור
    sendInvoice: false,                  // רק אם יש לכם מודול חשבוניות ב-HYP
    maxPayments: 1                       // מספר תשלומים מקסימלי
  },

  /* --- שמירת PNG של ברכות אישיות ב-Google Drive -------------------------
     ה-Web App של Google Apps Script מקבל PNG ושומר אותו בתיקיית Drive.
     אין כאן סיסמה או טוקן פרטי; זו כתובת ה-Web App שפרסמת כ-Anyone.       */
  greetingStorage: {
    provider: 'google-drive',
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwihifGS4X99s-q8yYuGvM7dNyz2ibrpsW0wDypYJH9-0_8b5aScDc1kP1aFyuVG4iurA/exec'
  },

  /* --- דף חזרה אחרי תשלום ------------------------------------------------ */
  successPath: '/thank-you',

  /* --- שפת ברירת מחדל של האתר ------------------------------------------- */
  defaultLang: 'he'
};

/* מאפשר לשרת התשלום לקרוא את אותן ההגדרות בדיוק */
if (typeof module !== 'undefined' && module.exports) { module.exports = { STORE_CONFIG: STORE_CONFIG }; }
