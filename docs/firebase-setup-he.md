# חיבור Journas לפרויקט Firebase חדש

האתר נמצא ב־https://journas-trip-planner.vercel.app והקוד ב־https://github.com/AlonTsur1601/Journas_Trip_Planner.

השם המוצג של הפרויקט הקיים כבר שונה ל־Journas. מזהה הפרויקט הקיים נשאר ללא שינוי כדי לשמור על המשתמשים והטיולים. כדי שגם המזהה יכיל Journas, צור פרויקט חדש לפי ההוראות הבאות. אל תמחק את הפרויקט הישן עד שהמעבר והנתונים נבדקו; משתמשים וטיולים אינם עוברים אוטומטית.

## 1. יצירת הפרויקט

1. פתח https://console.firebase.google.com/ עם חשבון Google שלך.
2. אם מוצג פרויקט קיים, לחץ על הלוגו של Firebase כדי להגיע לרשימת הפרויקטים.
3. לחץ **Create a project** או **Add project**.
4. בשדה שם הפרויקט כתוב **Journas**.
5. ערוך את **Project ID** ל־`journas-trip-planner`. אם הוא תפוס, בחר מזהה דומה, למשל `journas-trip-planner-alon`, ושמור את המזהה שבחרת.
6. כבה **Google Analytics**, והשלם את יצירת הפרויקט. השאר את מסלול **Spark**; אל תחבר חשבון חיוב.

## 2. אפליקציית Web

1. ב־**Project Overview** לחץ על סמל **Web `</>`**.
2. בשדה **App nickname** כתוב **Journas Web**.
3. השאר את **Firebase Hosting** לא מסומן: האירוח של האתר הוא ב־Vercel.
4. לחץ **Register app**, ולאחר מכן **Continue to console**.
5. להגדרות האפליקציה אפשר לחזור דרך **Settings → Project settings → General → Your apps → Journas Web → SDK setup and configuration → Config**.

## 3. התחברות

1. בתפריט הצד פתח **Build → Authentication**, ולחץ **Get started** אם הוא מוצג.
2. ב־**Sign-in method**, פתח **Email/Password**. הפעל את האפשרות **Email/Password** הראשונה ולחץ **Save**. אין צורך להפעיל Email link.
3. פתח **Google**, הפעל **Enable**, וכתוב **Journas** בשדה **Public-facing name for project**.
4. בחר כתובת בשדה **Support email for project**, ולחץ **Save**. כתובת זו עשויה להופיע כחלק מפרטי התמיכה במסכי ההרשאה של Google.
5. עבור ל־**Authentication → Settings → Authorized domains**.
6. לחץ **Add domain**, כתוב `journas-trip-planner.vercel.app` ללא `https://`, ושמור.

## 4. מסד הנתונים

1. בתפריט הצד פתח **Build → Firestore Database → Create database**.
2. אם מוצגת בחירת מהדורה, בחר **Standard**.
3. השאר את מזהה מסד הנתונים **(default)**.
4. בחר מיקום אירופי, למשל **europe-west1**, ולחץ **Next**.
5. בחר **Production mode**, והשלם את היצירה.
6. פתח **Firestore Database → Rules**. פתח במחשב את `firestore.rules` בתיקיית Journas, העתק את כל תוכנו לעורך והקש **Publish**. הכללים מאפשרים קריאה למשתתפים מורשים; כתיבת התכנון מתבצעת דרך השרת.

## 5. הגדרות ומפתח שרת — שמירה מקומית בלבד

1. דרך **Project settings → General → Your apps → Journas Web → Config**, העתק את הגדרות ה־Web לקובץ מקומי בשם `journas-firebase-web-config.local.txt` בתוך תיקיית Journas. הקובץ מוחרג מ־Git. אין צורך לשלוח את תוכנו בצ׳אט.
2. פתח **Project settings → Service accounts → Firebase Admin SDK**.
3. לחץ **Generate new private key**, אשר והורד את קובץ ה־JSON.
4. שמור אותו מחוץ למאגר, לצד תיקיית Journas, בשם `journas-new-firebase-service-account.json`. אל תחליף את המפתח של הפרויקט הישן ואל תעלה את הקובץ ל־GitHub.
5. שלח בצ׳אט רק את **Project ID**, וציין שסיימת וששני הקבצים נשמרו.

לאחר מכן אפשר לעדכן מקומית את משתני הסביבה, לחבר את השרת והדפדפן לפרויקט החדש, לפרסם את האינדקסים מתוך `firestore.indexes.json`, ולבדוק את האתר הפרוס. ה־README כולל גם הוראות התקנה באנגלית. אין לשנות את החיבור הפעיל או למחוק את הפרויקט הקודם לפני שבודקים את המעבר.

מקורות: [הגדרת Firebase ל־Web](https://firebase.google.com/docs/web/setup), [מזהי פרויקט Firebase](https://firebase.google.com/docs/projects/learn-more#project-id).
