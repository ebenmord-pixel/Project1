const XLSX = require('xlsx');
const db = require('./db');

const TEMPLATE_HEADERS = ['שם פרטי', 'שם משפחה', 'מספר רכב', 'יצרן', 'דגם', 'שנת ייצור', 'תחילת חוזה ליסינג', 'טלפון', 'מייל', 'שם משתמש', 'סיסמה'];

function buildTemplateBuffer() {
  const example = ['ישראל', 'ישראלי', '12-345-67', 'יונדאי', 'טוסון (Tucson)', 2023, '2024-01-15', '0501234567', 'israel@example.com', 'israel.i', 'Passw0rd!'];
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'עובדים');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || '').trim();
}

function importFromBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const results = { created: 0, errors: [] };

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    const firstName = String(row['שם פרטי'] || '').trim();
    const lastName = String(row['שם משפחה'] || '').trim();
    const vehicleNumber = String(row['מספר רכב'] || '').trim();
    const manufacturer = String(row['יצרן'] || '').trim();
    const model = String(row['דגם'] || '').trim();
    const year = String(row['שנת ייצור'] || '').trim();
    const leaseStartDate = normalizeDate(row['תחילת חוזה ליסינג']);
    const phone = String(row['טלפון'] || '').trim();
    const email = String(row['מייל'] || '').trim();
    const username = String(row['שם משתמש'] || '').trim();
    const password = String(row['סיסמה'] || '').trim();

    if (!firstName || !lastName || !vehicleNumber || !leaseStartDate || !username || !password) {
      results.errors.push(`שורה ${rowNum}: חסרים שדות חובה (שם פרטי, שם משפחה, מספר רכב, תחילת חוזה ליסינג, שם משתמש, סיסמה)`);
      return;
    }

    try {
      db.createEmployee({ firstName, lastName, vehicleNumber, manufacturer, model, year, leaseStartDate, phone, email, username, password });
      results.created++;
    } catch (err) {
      results.errors.push(`שורה ${rowNum}: ${err.message}`);
    }
  });

  return results;
}

module.exports = { buildTemplateBuffer, importFromBuffer, TEMPLATE_HEADERS };
