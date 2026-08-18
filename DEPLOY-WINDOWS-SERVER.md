# התקנה על שרת Windows Server פנימי (חוות השרתים)

מדריך זה מסביר איך להעלות את האפליקציה לשרת Windows Server בחברה כך שהיא תרוץ **24/7**, גם אחרי הפעלה מחדש של השרת, ותהיה נגישה לכל העובדים מתוך רשת המשרד (בלי חשיפה לאינטרנט).

זה מבוצע על השרת עצמו (לא על המחשב האישי שלך) — כנראה בעזרת מנהל ה-IT, אם אין לך הרשאות אדמין על השרת.

## שלב 1: התקנת Node.js על השרת

1. ב-Remote Desktop (או ישירות) לשרת, גשי ל-**https://nodejs.org**
2. הורידי והתקיני את גרסת **LTS**
3. אמתי בשורת פקודה (CMD) על השרת:
   ```cmd
   node -v
   npm -v
   ```

## שלב 2: העתקת קבצי הפרויקט לשרת

1. ב-GitHub, בכתובת `https://github.com/ebenmord-pixel/Project1/tree/claude/vehicle-mileage-reporting-app-0glsnk`, לחצי **Code → Download ZIP**
2. חלצי לתיקייה קבועה על השרת, למשל: `C:\Apps\Project1`

## שלב 3: התקנת התלויות

בשורת פקודה, בתוך תיקיית הפרויקט:
```cmd
cd C:\Apps\Project1
npm install --omit=dev
```

## שלב 4: קובץ הגדרות (`.env`)

העתיקי את `.env.example` לקובץ בשם `.env` באותה תיקייה, ומלאי:

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=fleet-officer@yourcompany.com
SMTP_PASS=הסיסמה-או-סיסמת-האפליקציה
MAIL_FROM=fleet-officer@yourcompany.com

# כתובת שבה עובדים בתוך המשרד יגיעו לאפליקציה - ראו שלב 6
APP_BASE_URL=http://fleet-app:3000

SESSION_SECRET=<ערך אקראי וסודי — לדוגמה תוצאה של הפקודה `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`>
PORT=3000
```

## שלב 5: הרצה כ"שירות Windows" קבוע (לא כחלון CMD פתוח)

אם פשוט מריצים `npm start` בחלון CMD, האפליקציה תיפסק ברגע שסוגרים את החלון או שהשרת מתאתחל. כדי שזה ירוץ תמיד ברקע — גם אחרי אתחול — הכי פשוט להשתמש בכלי חינמי בשם **NSSM** (Non-Sucking Service Manager) שהופך כל תוכנה לשירות Windows רגיל:

1. הורידי את NSSM מהאתר הרשמי: **https://nssm.cc/download**
2. חלצי את `nssm.exe` המתאים (64-bit) לתיקייה כלשהי, למשל `C:\nssm\nssm.exe`
3. פתחי CMD **כמנהל (Run as Administrator)** והריצי:
   ```cmd
   C:\nssm\nssm.exe install VehicleMileageApp
   ```
4. ייפתח חלון גרפי של NSSM:
   - **Path:** נתיב ל-`node.exe` (בדרך כלל `C:\Program Files\nodejs\node.exe`)
   - **Startup directory:** `C:\Apps\Project1`
   - **Arguments:** `server.js`
   - בלשונית **I/O** אפשר להפנות פלט ליומן (log) לקובץ, לדוגמה `C:\Apps\Project1\service.log`
   - לחצי **Install service**
5. הפעילי את השירות:
   ```cmd
   net start VehicleMileageApp
   ```
6. בדקי שזה עובד — פתחי דפדפן בשרת עצמו: `http://localhost:3000`

מעכשיו האפליקציה תעלה אוטומטית עם השרת, גם בלי שמישהו יתחבר.

**עדכון/הפעלה מחדש בעתיד:** אחרי שמעדכנים קבצים בתיקיית הפרויקט, צריך להפעיל מחדש את השירות כדי שהשינויים ייכנסו לתוקף:
```cmd
net stop VehicleMileageApp
net start VehicleMileageApp
```

## שלב 6: גישה מרשת המשרד + כתובת קבועה

1. **פתיחת פורט בחומת האש** — בשרת: Windows Defender Firewall → Advanced Settings → Inbound Rules → New Rule → Port → TCP → 3000 → Allow the connection → להגביל ל-**Private/Domain** בלבד (לא Public), כדי שזה יהיה נגיש רק מתוך רשת המשרד.
2. **כתובת קבועה וברורה** — במקום שכולם יזכרו כתובת IP (שעלולה גם להשתנות), הכי טוב לבקש ממנהל ה-IT רשומת **DNS פנימית** (למשל `fleet-app` שמצביעה ל-IP הפנימי של השרת). ואז עדכנו את `APP_BASE_URL` בקובץ `.env` בהתאם לכתובת שנבחרה, כדי שהקישורים בתזכורות המייל יהיו נכונים.
3. עובדים בתוך המשרד יוכלו לגשת מהדפדפן שלהם לכתובת: `http://fleet-app:3000` (או ל-IP הפנימי אם אין DNS פנימי).

## סיכום צ'ק-ליסט

- [ ] Node.js מותקן על השרת
- [ ] קבצי הפרויקט הועתקו ל-`C:\Apps\Project1`
- [ ] `npm install --omit=dev` הורץ בהצלחה
- [ ] קובץ `.env` מולא (כולל `SESSION_SECRET` ייחודי ו-`APP_BASE_URL` נכון)
- [ ] השירות הותקן דרך NSSM ורץ (`net start VehicleMileageApp`)
- [ ] פורט 3000 פתוח בחומת האש לרשת הפנימית בלבד
- [ ] יש כתובת קבועה (DNS פנימי או IP קבוע) שנמסרה לעובדים
- [ ] בדקתם התחברות מדפדפן במחשב אחר במשרד
