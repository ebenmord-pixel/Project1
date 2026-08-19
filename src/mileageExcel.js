const XLSX = require('xlsx');
const db = require('./db');
const { submitReport } = require('./reportValidation');

const ID_COL = 'מזהה עובד (אין לשנות)';
const MILEAGE_COL = "קילומטראז' עדכני (למילוי)";
const HEADERS = [ID_COL, 'שם פרטי', 'שם משפחה', 'מספר רכב', 'יצרן', 'דגם', 'שנת ייצור', "קילומטראז' אחרון ידוע", MILEAGE_COL];

function buildExportBuffer() {
  const employees = db.listEmployees();
  const rows = employees.map(emp => {
    const last = db.lastReportForUser(emp.id);
    return [
      emp.id,
      emp.firstName,
      emp.lastName,
      emp.vehicleNumber,
      emp.manufacturer || '',
      emp.model || '',
      emp.year || '',
      last ? last.mileage : '',
      ''
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "עדכון קילומטראז'");
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function importMileageFromBuffer(buffer, reportDate) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const results = { updated: 0, skippedEmpty: 0, errors: [] };

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const mileageRaw = row[MILEAGE_COL];

    if (mileageRaw === '' || mileageRaw === undefined || mileageRaw === null) {
      results.skippedEmpty++;
      return;
    }

    const id = row[ID_COL];
    const employee = db.getUserById(id);
    if (!employee || employee.role !== 'employee') {
      results.errors.push(`שורה ${rowNum}: מזהה עובד לא תקין (${id})`);
      return;
    }

    const { error } = submitReport({ userId: employee.id, vehicleNumber: employee.vehicleNumber, reportDate, mileage: mileageRaw });
    if (error) {
      results.errors.push(`שורה ${rowNum} (${employee.firstName} ${employee.lastName}): ${error}`);
      return;
    }
    results.updated++;
  });

  return results;
}

module.exports = { buildExportBuffer, importMileageFromBuffer, HEADERS, ID_COL, MILEAGE_COL };
