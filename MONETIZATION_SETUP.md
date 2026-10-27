# Journas — סביבת המנויים לבדיקות

האתר הרגיל נשאר קפוא. אין להפעיל פקודת פריסה כאשר `.vercel/project.json` מצביע ל־`journas-trip-planner`, ואין לפרוס כללי Firebase לפרויקט הרגיל.

## הסביבה הנפרדת

- ענף: `codex/monetization-staging`.
- Vercel: `journas-monetization-staging`.
- Firebase: `journas-monetization-2026`.
- מסד נתונים: Firestore באזור `eur3`.
- תשלומים: Sandbox בלבד. מודעות: דמה בלבד.
- מפתחות שרת אינם חלק מהמאגר או מחבילת הדפדפן. ההתחברות באימייל עוברת דרך `/api/firebase-auth`; כניסה ב־Google אינה מופעלת בסביבת הבדיקה הזאת.

## חשבונות בדיקה

פרטי הכניסה נמסרים בקובץ המקומי `STAGING_ACCOUNTS.local.md`, שאינו נשלח למאגר או לפריסה. החשבונות `tourist@journas.test`, `traveler@journas.test` ו־`adventurer@journas.test` מקבלים הקצאת דרגה מהשרת ללא תשלום. החשבון `billing@journas.test` מיועד לבדיקות תשלום, ללא הקצאת דרגה קבועה. אין לשלוח מפתחות או סיסמאות בצ'אט.

לכל חשבון תכנון יש טיול משלו וגם גישה לטיולים של הדרגות האחרות. כך אפשר לבדוק TODO מקושר בזכות הבעלים, לצד כלי נוחות אישיים שנשארים נעולים. השלמת המדריך ניתנת להפעלה מחדש מתוך Settings.

## הפעלת Firebase Authentication

1. היכנס לחשבון Google שמנהל את הפרויקט.
2. פתח https://console.firebase.google.com/project/journas-monetization-2026/authentication.
3. לחץ **Get started** אם מוצג. אין צורך להוסיף כרטיס או לשדרג ל־Identity Platform בתשלום.
4. הפעל **Email/Password**. כניסה ב־Google נשארת כבויה בסביבת בדיקה זו.
5. ברשימת Authorized domains ודא שקיימת כתובת סביבת הבדיקה.
6. לאחר מכן אפשר להריץ את סקריפט הקמת משתמשי הבדיקה. הוא אינו משנה משתמשים בפרויקט הרגיל.

## חיבור Paddle Sandbox עם ההורה או האפוטרופוס

1. פתחו חשבון Sandbox ב־https://sandbox-vendors.paddle.com. אין להזין כרטיס אמיתי לצורך בדיקות רכישה.
2. צרו מוצר traveler ומוצר adventurer. לכל אחד צרו מחיר חודשי ושנתי בדולרים: 4.99/49.99 ו־9.99/99.99.
3. הגדירו את כתובת סביבת הבדיקה ככתובת Checkout מותרת ואת `/upgrade` כעמוד התשלום/החזרה.
4. צרו מפתח Sandbox בעל הרשאות Transactions, Subscriptions ו־Customer portal sessions. הכניסו אותו ישירות ב־Vercel במשתנה השרת `PADDLE_API_KEY`. אין להשתמש בקידומת `VITE_`.
5. בלשונית **Client-side tokens** צרו אסימון Sandbox שמתחיל ב־`test_` והזינו ב־`PADDLE_CLIENT_TOKEN`. זהו אסימון ציבורי המיועד ל־Paddle.js; מפתח השרת לעולם אינו נשלח לדפדפן. ספריית התשלום נטענת רק לאחר חיבור Sandbox, והמחירים נקבעים בשרת.
6. הגדירו את ארבעת מזהי המחירים במשתנים `PADDLE_PRICE_TRAVELER_MONTH`, `PADDLE_PRICE_TRAVELER_YEAR`, `PADDLE_PRICE_ADVENTURER_MONTH`, `PADDLE_PRICE_ADVENTURER_YEAR`.
7. צרו Notification destination לכתובת `/api/billing-webhook` באתר הבדיקה והזינו את סוד החתימה במשתנה השרת `PADDLE_WEBHOOK_SECRET`.
8. הפעילו אירועי subscription, transaction.completed ו־adjustment.updated הרלוונטיים.
9. פרסו מחדש **רק את פרויקט הבדיקה**. התחברו בחשבון billing ובדקו רכישה, ביטול, שינוי תוכנית וכשל תשלום בעזרת כרטיסי הבדיקה שבתיעוד Paddle.

חשבון דרגה קבועה אינו מתאים לבדיקה הזו: הוא בכוונה אינו משתנה כתוצאה מתשלום.

מקורות: https://developer.paddle.com/sdks/sandbox/ · https://developer.paddle.com/build/go-live-checklist/ · https://developer.paddle.com/webhooks/about/signature-verification/.

## מה נדרש לפני קבלת כסף אמיתי

ההורה או האפוטרופוס צריך להסדיר את הבעלות, אימות הזהות, אמצעי קבלת הכסף ואישור האתר מול הספק. יש לוודא שהספק מקבל את מבנה הפעילות בפועל ולבדוק את העמלה לחיוב של 4.99 דולר. אין להפעיל מכירה אמיתית לפני השלמת תנאים, פרטיות, החזרים ופרטי קשר תואמים. עמודי התנאים הנוכחיים מסומנים כעמודי בדיקה.

אין להחליף את `BILLING_ENV=sandbox` בפרויקט הזה: ההגנות מכוונות להכשיל ניסיון הפעלה אמיתית. המעבר העתידי לייצור הוא עבודה נפרדת.

## מודעות Google

סביבת הבדיקה אינה טוענת AdSense ואינה יוצרת חשיפות, לחיצות או מעקב. התוויות הן הדגמת פריסה בלבד. אין מודעות עליונות, בהגדרות, בהתחברות, במדריך או במסך השדרוג. המודעה בטלפון נגללת עם תוכן החלון.

המדיניות אינה מבטיחה אישור: מסכי ניווט ותוכן לא מספק עלולים להיפסל. אם אף מיקום קיים לא מתאים, אין להפעיל מודעות אמת במקום אחר ללא תכנון נוסף.

להכנה עתידית ההורה פותח AdSense על שמו, מוסיף את האתר, משלים אימות ואישור, יוצר יחידות Display ידניות, מכבה Auto ads ומגדיר CMP מוסמך ונגישות לשינוי הסכמה. אין להעביר מידע פרטי מהטיולים לפרסום.

מקורות: https://support.google.com/adsense/answer/9724?hl=en · https://support.google.com/publisherpolicies/answer/11112688?hl=en · https://support.google.com/adsense/answer/1346295?hl=en · https://support.google.com/adsense/answer/10734935?hl=en · https://support.google.com/adsense/answer/13554116?hl=en.

## דוא"ל ומחיקה

הודעות תפוגה נשמרות כהודעות ממתינות ומוצגות בבית לפי המועד המאומת. כתובות `.test` אינן מקבלות דוא"ל. לשליחת הודעות אמיתית נדרש חיבור דוא"ל נפרד של הבדיקות; אין להעתיק את סודות שירות הדוא"ל מהייצור. יש לבדוק בנפרד תזמון, מניעת כפילות, ביטול התרעה אחרי שדרוג ומחיקת הבעלים עבור כולם.

## המשך ב־01:00

העבודה חודשה ב־27 באוקטובר 2026 ב־01:00 לאחר בדיקת המכסה. התזמון החד־פעמי `journas-01-00` בוטל לאחר החידוש המוצלח. הוא לא צרך זיכויי איפוס ולא החליף חיבור לחשבון חיצוני.

שינוי חודשי/שנתי משמר את מועד סיום התקופה שכבר שולמה, ללא חיוב מיידי. ההרשאות ותדירות החיוב משתנות לאחר אישור תשלום לתקופה החדשה. יש להשלים בדיקת ספק בפועל לאחר הזנת פרטי Sandbox. מקורות: [עדכון מנוי](https://developer.paddle.com/api-reference/subscriptions/update-subscription/), [מעבר בין תדירויות](https://developer.paddle.com/build/subscriptions/replace-products-prices-upgrade-downgrade/), [קישור תשלום](https://developer.paddle.com/build/transactions/pass-transaction-checkout/).

תזמון התרעות, ביטולן אחרי שדרוג, ניסיונות חוזרים ונעילת עובדים מקבילים נבדקו אוטומטית. מסירת דוא״ל אמיתית דורשת בדיקת תיבת קבלה אחרי חיבור SMTP נפרד. תקלה אחרי קבלת הודעה אצל הספק ולפני שמירת ההצלחה עלולה לגרום למסירה חוזרת; SMTP אינו מספק הבטחת exactly-once.


### מיילי חיוב וניהול מנוי
Paddle כוללת במיילי המנוי קישור לפורטל ולביטול. בנוסף, לאחר `transaction.completed` מאומת Journas שומרת הודעת ניהול אחת לכל עסקה בתור `billingNotices`. ההודעה כוללת כפתור ביטול חיובים עתידיים; ב־adventurer נוסף כפתור מעבר ל־traveler. הקישורים פותחים את עמוד השדרוג ומחייבים כניסה ואישור, ללא שינוי מנוי מעצם פתיחת מייל. ההורדה והביטול נשארים בסוף התקופה ששולמה.
המסירה משתמשת ב־SMTP הנפרד; webhook מנסה לשלוח, והתחזוקה היומית מנסה שוב הודעות שנכשלו. חשבונות `.test` אינם מקבלים מיילים. אין כרגע Paddle/SMTP מחוברים, ולכן מסירה אמיתית וקבלת קבלה אצל הספק עדיין דורשות בדיקת Sandbox. SMTP עלול למסור כפול אם התהליך קורס לאחר השליחה ולפני שמירת ההצלחה.
מקורות ספק: https://developer.paddle.com/build/subscriptions/cancel-subscriptions/ ו־https://developer.paddle.com/concepts/sell/customer-portal/ .
