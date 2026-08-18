const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const db = require('./src/db');
const { requireLogin, requireRole } = require('./src/auth');
const vehicleCatalog = require('./src/vehicleCatalog');
const messageLinks = require('./src/messageLinks');
const { submitReport } = require('./src/reportValidation');
const excelImport = require('./src/excelImport');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

function employeeFieldsFromBody(body) {
  const { firstName, lastName, vehicleNumber, manufacturer, model, year, leaseStartDate, phone, email, username, password } = body;
  return { firstName, lastName, vehicleNumber, manufacturer, model, year, leaseStartDate, phone, email, username, password };
}

// --- Auth ---
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.getUserByUsername(username || '');
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.render('login', { error: 'שם משתמש או סיסמה שגויים' });
  }
  req.session.user = { id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName };
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', requireLogin, (req, res) => {
  if (req.session.user.role === 'officer') return res.redirect('/dashboard');
  res.redirect('/my-reports');
});

// --- Officer: main dashboard ---
app.get('/dashboard', requireLogin, requireRole('officer'), (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const employees = db.listEmployees().map(emp => {
    const reportUrl = `${baseUrl}/report/${emp.reportToken}`;
    const message = `שלום ${emp.firstName}, נא לדווח את קילומטראז' הרכב (${emp.vehicleNumber}) דרך הקישור: ${reportUrl}`;
    return {
      ...emp,
      reportUrl,
      waLink: messageLinks.whatsAppLink(emp.phone, message),
      mailLink: messageLinks.mailtoLink(emp.email, "דיווח קילומטראז' רכב חברה", message)
    };
  });
  const reports = db.listReportsWithUsers().slice(0, 50);
  res.render('dashboard', { employees, reports });
});

app.get('/employees/new', requireLogin, requireRole('officer'), (req, res) => {
  res.render('employee-form', { employee: null, error: null, vehicleCatalog });
});

app.post('/employees', requireLogin, requireRole('officer'), (req, res) => {
  const fields = employeeFieldsFromBody(req.body);
  try {
    if (!fields.firstName || !fields.lastName || !fields.vehicleNumber || !fields.leaseStartDate || !fields.username || !fields.password) {
      throw new Error('יש למלא את כל שדות החובה');
    }
    db.createEmployee(fields);
    res.redirect('/dashboard');
  } catch (err) {
    res.render('employee-form', { employee: null, error: err.message, vehicleCatalog });
  }
});

// --- Officer: bulk import from Excel (must be registered before the /employees/:id routes) ---
app.get('/employees/import', requireLogin, requireRole('officer'), (req, res) => {
  res.render('import-employees', { result: null, error: null });
});

app.get('/employees/import/template', requireLogin, requireRole('officer'), (req, res) => {
  const buffer = excelImport.buildTemplateBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="employees-template.xlsx"');
  res.send(buffer);
});

app.post('/employees/import', requireLogin, requireRole('officer'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.render('import-employees', { result: null, error: 'יש לבחור קובץ אקסל' });
  }
  try {
    const result = excelImport.importFromBuffer(req.file.buffer);
    res.render('import-employees', { result, error: null });
  } catch (err) {
    res.render('import-employees', { result: null, error: 'שגיאה בקריאת הקובץ: ' + err.message });
  }
});

app.get('/employees/:id/edit', requireLogin, requireRole('officer'), (req, res) => {
  const employee = db.listEmployees().find(e => e.id === Number(req.params.id));
  if (!employee) return res.status(404).render('error', { message: 'העובד לא נמצא' });
  res.render('employee-form', { employee, error: null, vehicleCatalog });
});

app.post('/employees/:id', requireLogin, requireRole('officer'), (req, res) => {
  const fields = employeeFieldsFromBody(req.body);
  try {
    if (!fields.firstName || !fields.lastName || !fields.vehicleNumber || !fields.leaseStartDate || !fields.username) {
      throw new Error('יש למלא את כל שדות החובה (למעט סיסמה, אלא אם רוצים לשנות אותה)');
    }
    db.updateEmployee(req.params.id, fields);
    res.redirect('/dashboard');
  } catch (err) {
    const employee = { id: Number(req.params.id), ...fields };
    res.render('employee-form', { employee, error: err.message, vehicleCatalog });
  }
});

app.post('/employees/:id/delete', requireLogin, requireRole('officer'), (req, res) => {
  db.deleteEmployee(req.params.id);
  res.redirect('/dashboard');
});

app.post('/employees/:id/regenerate-token', requireLogin, requireRole('officer'), (req, res) => {
  db.regenerateReportToken(req.params.id);
  res.redirect('/dashboard');
});

app.get('/employees/:id/reports', requireLogin, requireRole('officer'), (req, res) => {
  const employee = db.listEmployees().find(e => e.id === Number(req.params.id));
  if (!employee) return res.status(404).render('error', { message: 'העובד לא נמצא' });
  const reports = db.listReports({ userId: employee.id });
  res.render('employee-reports', { employee, reports });
});

// --- Employee: submit + view own reports ---
app.get('/my-reports', requireLogin, requireRole('employee'), (req, res) => {
  const employee = db.getUserById(req.session.user.id);
  const reports = db.listReports({ userId: employee.id });
  res.render('my-reports', { employee, reports, error: null });
});

app.post('/my-reports', requireLogin, requireRole('employee'), (req, res) => {
  const employee = db.getUserById(req.session.user.id);
  const { reportDate, mileage } = req.body;
  const { error } = submitReport({ userId: employee.id, vehicleNumber: employee.vehicleNumber, reportDate, mileage });
  if (error) {
    const reports = db.listReports({ userId: employee.id });
    return res.render('my-reports', { employee, reports, error });
  }
  res.redirect('/my-reports');
});

// --- Public: report via personal link (no login, for WhatsApp / email) ---
app.get('/report/:token', (req, res) => {
  const employee = db.getEmployeeByReportToken(req.params.token);
  if (!employee) return res.status(404).render('error', { message: 'קישור הדיווח אינו תקין' });
  res.render('public-report', { employee, error: null, submitted: false });
});

app.post('/report/:token', (req, res) => {
  const employee = db.getEmployeeByReportToken(req.params.token);
  if (!employee) return res.status(404).render('error', { message: 'קישור הדיווח אינו תקין' });
  const { reportDate, mileage } = req.body;
  const { error } = submitReport({ userId: employee.id, vehicleNumber: employee.vehicleNumber, reportDate, mileage });
  if (error) {
    return res.render('public-report', { employee, error, submitted: false });
  }
  res.render('public-report', { employee, error: null, submitted: true });
});

app.listen(PORT, () => {
  console.log(`השרת פועל בכתובת http://localhost:${PORT}`);
});
