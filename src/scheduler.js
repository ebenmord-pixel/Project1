const cron = require('node-cron');
const mailer = require('./mailer');
const { sendMonthlyReminders } = require('./reminderJob');

function start() {
  if (!mailer.isConfigured()) {
    console.log('תזכורות מייל חודשיות: לא הוגדרו פרטי SMTP, התזמון האוטומטי לא הופעל (ראו README).');
    return;
  }
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  // "0 8 1 * *" = 08:00 בבוקר, ה-1 לכל חודש, לפי שעון השרת שרץ עליו התהליך
  cron.schedule('0 8 1 * *', async () => {
    console.log('מריץ שליחת תזכורות קילומטראז\' חודשיות...');
    try {
      const results = await sendMonthlyReminders(baseUrl);
      console.log(`תזכורות חודשיות: נשלחו ${results.sent.length}, נכשלו ${results.failed.length}, ללא כתובת מייל ${results.skipped.length}`);
    } catch (err) {
      console.error('שגיאה בשליחת תזכורות חודשיות:', err.message);
    }
  });
  console.log(`תזמון תזכורות חודשיות הופעל (1 לכל חודש, 08:00, כתובת בסיס: ${baseUrl}).`);
}

module.exports = { start };
