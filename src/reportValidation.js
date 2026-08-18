const db = require('./db');

function submitReport({ userId, vehicleNumber, reportDate, mileage }) {
  if (!reportDate || !mileage) return { error: "יש למלא תאריך וקילומטראז'" };
  if (new Date(reportDate) > new Date()) return { error: 'לא ניתן לדווח על תאריך עתידי' };

  const mileageNum = Number(mileage);
  if (!Number.isFinite(mileageNum) || mileageNum < 0) return { error: "קילומטראז' לא תקין" };

  const last = db.lastReportForUser(userId);
  if (last && mileageNum < last.mileage) {
    return { error: `הקילומטראז' שהוזן (${mileageNum}) קטן מהדיווח האחרון (${last.mileage})` };
  }

  const report = db.addReport({ userId, vehicleNumber, reportDate, mileage: mileageNum });
  return { report };
}

module.exports = { submitReport };
