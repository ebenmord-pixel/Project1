const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = require('./src/db');
const { requireLogin, requireRole } = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;

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
  const employees = db.listEmployees();
  const reports = db.listReportsWithUsers().slice(0, 50);
  res.render('dashboard', { employees, reports });
});

app.get('/employees/new', requireLogin, requireRole('officer'), (req, res) => {
  res.render('employee-form', { employee: null, error: null });
});

app.post('/employees', requireLogin, requireRole('officer'), (req, res) => {
  const { firstName, lastName, vehicleNumber, leaseStartDate, username, password } = req.body;
  try {
    if (!firstName || !lastName || !vehicleNumber || !leaseStartDate || !username || !password) {
      throw new Error('יש למלא את כל השדות');
    }
    db.createEmployee({ firstName, lastName, vehicleNumber, leaseStartDate, username, password });
    res.redirect('/dashboard');
  } catch (err) {
    res.render('employee-form', { employee: null, error: err.message });
  }
});

app.get('/employees/:id/edit', requireLogin, requireRole('officer'), (req, res) => {
  const employee = db.listEmployees().find(e => e.id === Number(req.params.id));
  if (!employee) return res.status(404).render('error', { message: 'העובד לא נמצא' });
  res.render('employee-form', { employee, error: null });
});

app.post('/employees/:id', requireLogin, requireRole('officer'), (req, res) => {
  const { firstName, lastName, vehicleNumber, leaseStartDate, username, password } = req.body;
  try {
    if (!firstName || !lastName || !vehicleNumber || !leaseStartDate || !username) {
      throw new Error('יש למלא את כל השדות (למעט סיסמה, אלא אם רוצים לשנות אותה)');
    }
    db.updateEmployee(req.params.id, { firstName, lastName, vehicleNumber, leaseStartDate, username, password });
    res.redirect('/dashboard');
  } catch (err) {
    const employee = { id: Number(req.params.id), firstName, lastName, vehicleNumber, leaseStartDate, username };
    res.render('employee-form', { employee, error: err.message });
  }
});

app.post('/employees/:id/delete', requireLogin, requireRole('officer'), (req, res) => {
  db.deleteEmployee(req.params.id);
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
  const reports = db.listReports({ userId: employee.id });

  const errorRender = (message) => res.render('my-reports', { employee, reports, error: message });

  if (!reportDate || !mileage) return errorRender('יש למלא תאריך וקילומטראז\'');
  if (new Date(reportDate) > new Date()) return errorRender('לא ניתן לדווח על תאריך עתידי');

  const mileageNum = Number(mileage);
  if (!Number.isFinite(mileageNum) || mileageNum < 0) return errorRender('קילומטראז\' לא תקין');

  const last = db.lastReportForUser(employee.id);
  if (last && mileageNum < last.mileage) {
    return errorRender(`הקילומטראז' שהוזן (${mileageNum}) קטן מהדיווח האחרון (${last.mileage})`);
  }

  db.addReport({ userId: employee.id, vehicleNumber: employee.vehicleNumber, reportDate, mileage: mileageNum });
  res.redirect('/my-reports');
});

app.listen(PORT, () => {
  console.log(`השרת פועל בכתובת http://localhost:${PORT}`);
});
