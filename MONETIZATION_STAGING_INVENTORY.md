# פריטים ייעודיים לסביבת הבדיקה

המלאי מיועד להכנת מעבר עתידי לייצור. אין להסיר הגנות, להפעיל סליקה או פרסום אמיתיים, או להעביר נתונים וסודות במסגרת סביבת הבדיקה.

## טקסט ותצוגות לבדיקה

- `src/MockAd.tsx`, השימושים ב־`src/HomePage.tsx` וב־`src/App.tsx`, וכללי `.mock-*` ו־`.modal-ad` ב־`src/plans.css`: מודעות דמה, כולל הטקסט Test advertisement / Ad preview / Google approval required. יש להחליף בשילוב פרסום מאושר רק לאחר בדיקת המיקומים וההסכמה.
- `src/UpgradePage.tsx`: הודעת Fixed test entitlement וההודעה שמופיעה בניסיון רכישה מחשבון עם תוכנית בדיקה קבועה. הסברים על חיוב שנתי, מסים, ביטול ושיתוף שמופיעים מתחת לכרטיסים הם מידע מוצרי, לא תווית בדיקה; יש לעדכן אותם לפי תנאי הספק בפועל.
- `src/App.tsx`, `src/AccountCredentials.tsx`: כניסה באמצעות Google ויצירת חשבונות מוגבלות בסביבת הבדיקה, עם טקסט הסבר. יש לתכנן את תהליכי הייצור מחדש, ולא להסיר את המגבלות מהבדיקה.
- `public/terms.html`, `public/refunds.html`, `public/privacy.html`: מסמכי בדיקה, לרבות תיאורי Sandbox ומודעות דמה. יש להכין מסמכי ייצור מתאימים לפני הפעלה אמיתית.
- `src/plans.css`: כללי `.testing-banner` ו־`.testing-label` נשארו ללא שימוש; ניתן להסיר אותם עם ניקוי קוד הבדיקה.

## זהויות, שירותים ובידוד

- פרויקט Firebase `journas-monetization-2026`, פרויקט Vercel `journas-monetization-staging` והחשבונות `*.test` נועדו לבדיקה בלבד. הרשאות תוכנית קבועות מסוג `source: 'test'` מטופלות ב־`shared/plans.ts` וב־`server/billing.ts`; אין להעניק אותן למשתמשי ייצור. תורי ההודעות ב־`server/billing.ts`, `server/billing-mail.ts` ו־`server/retention-notices.ts` מסמנים הודעות לכתובות `.test` כבדיקה בלבד.
- טיולי ההדגמה הכפולים של פריז מסומנים ב־Firebase הבדיקות בלבד באמצעות `calendarDemoGroup`; קיבוצם בלוח השנה ממומש ב־`src/calendar-trips.ts` ויש להסירו עם נתוני ההדגמה לקראת יציאה לייצור.
- `server/staging.ts`, `vite.config.ts`, `server/http.ts` ו־`api/firebase-auth.ts`: בדיקות סביבה, רשימת חשבונות מורשים וחסימת חיבור שגוי. אלה הגנות חשובות לבדיקה; מעבר לייצור מחייב חלופה מפורשת ובטוחה, לא מחיקה עיוורת שלהן.
- `src/firebase.ts` ו־`api/firebase-auth.ts`: תצורת לקוח ו־proxy לאימות הבדיקה. יש להחליף בתצורת האימות שנבחרה לייצור ולבדוק מחדש את גבולות האבטחה.
- `server/billing.ts`, `src/paddle-checkout.ts`, `api/billing-webhook.ts` ו־`server/billing-mail.ts`: מסלולי Paddle Sandbox וקישורי סביבת בדיקה. נדרשים חשבון ספק, מוצרי ייצור, מפתחות נפרדים ואימות מקצה לקצה לפני חיוב אמיתי.
- `vercel.json` ו־`public/robots.txt`: חסימת אינדוקס לבדיקה. יש לקבוע מדיניות אינדוקס מתאימה לפריסת הייצור, תוך השארת סביבת הבדיקה חסומה.
- `.env.staging.local`, קובצי `*.local*` ו־`STAGING_ACCOUNTS.local.md` מוחרגים מ־Git ומפריסה; הם מכילים תצורה או פרטי בדיקה מקומיים ואין להעבירם לייצור.
- בפרויקט Vercel הרגיל הוגדר Ignored Build Step ייעודי לענף `codex/monetization-staging`, כדי למנוע בניות Preview שגויות. זהו כלל תפעולי בפרויקט Vercel, לא קובץ מאגר; יש לבחון אותו כשענף הבדיקה יפסיק לשמש.

המדריך ונתוני התרגול המבודדים שב־`src/GuidedTour.tsx` וב־`server/practice.ts` הם יכולת מוצר רצויה. אין להסירם רק מפני שהם משתמשים בנתוני תרגול.
