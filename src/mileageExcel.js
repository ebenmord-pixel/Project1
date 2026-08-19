const XLSX = require('xlsx');
const db = require('./db');
const { submitReport } = require('./reportValidation');

const HEADERS = ['שם פרטי', 'שם משפחה', 'יצרן', 'דגם', 'שנת ייצור', 'מספר רכב', 'תחילת חוזה ליסינג', "קילומטראז'"];

function buildExportBuffer() {
  const employees = db.listEmployees();
  const rows = [HEADERS];
  employees.forEach(emp => {
    rows.push([emp.firstName, emp.lastName, emp.manufacturer || '', emp.model || '', emp.year || '', emp.vehicleNumber, emp.leaseStartDate, '']);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "קילומטראז'");
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function importFromBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const employees = db.listEmployees();
  const today = new Date().toISOString().slice(0, 10);
  const results = { updated: 0, skipped: 0, errors: [] };

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    const vehicleNumber = String(row['מספר רכב'] || '').trim();
    const mileageRaw = row["קילומטראז'"];
    const mileageStr = String(mileageRaw === undefined || mileageRaw === null ? '' : mileageRaw).trim();

    if (!vehicleNumber) {
      results.errors.push(`שורה ${rowNum}: חסר מספר רכב, לא ניתן לשייך את השורה לעובד`);
      return;
    }

    if (!mileageStr) {
      // No mileage reported this round - perfectly fine, just skip the row.
      results.skipped++;
      return;
    }

    const matches = employees.filter(e => e.vehicleNumber.trim() === vehicleNumber);
    if (matches.length === 0) {
      results.errors.push(`שורה ${rowNum}: לא נמצא עובד עם מספר רכב ${vehicleNumber}`);
      return;
    }
    if (matches.length > 1) {
      results.errors.push(`שורה ${rowNum}: נמצאו כמה עובדים עם מספר רכב ${vehicleNumber}, לא ניתן לעדכן אוטומטית`);
      return;
    }

    const employee = matches[0];
    const { error } = submitReport({ userId: employee.id, vehicleNumber: employee.vehicleNumber, reportDate: today, mileage: mileageStr });
    if (error) {
      results.errors.push(`שורה ${rowNum} (${employee.firstName} ${employee.lastName}): ${error}`);
      return;
    }
    results.updated++;
  });

  return results;
}

module.exports = { buildExportBuffer, importFromBuffer, HEADERS };
