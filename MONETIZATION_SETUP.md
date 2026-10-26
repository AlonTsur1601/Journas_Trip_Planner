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
5. הגדירו את ארבעת מזהי המחירים במשתנים `PADDLE_PRICE_TRAVELER_MONTH`, `PADDLE_PRICE_TRAVELER_YEAR`, `PADDLE_PRICE_ADVENTURER_MONTH`, `PADDLE_PRICE_ADVENTURER_YEAR`.
6. צרו Notification destination לכתובת `/api/billing-webhook` באתר הבדיקה והזינו את סוד החתימה במשתנה השרת `PADDLE_WEBHOOK_SECRET`.
7. הפעילו אירועי subscription, transaction.completed ו־adjustment.updated הרלוונטיים.
8. פרסו מחדש **רק את פרויקט הבדיקה**. התחברו בחשבון billing ובדקו רכישה, ביטול, שינוי תוכנית וכשל תשלום בעזרת כרטיסי הבדיקה שבתיעוד Paddle.

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

החידוש `journas-01-00` מיועד להמשיך רק אם העבודה נקטעה בגלל מגבלת שימוש ועדיין לא הסתיימה. הוא אינו עוקף מגבלה פעילה ואינו מחליף השלמת חיבור לחשבון חיצוני. עם השלמת העבודה יש לבטל אותו.
