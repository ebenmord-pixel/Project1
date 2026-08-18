const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function emptyDB() {
  return { users: [], reports: [], nextUserId: 1, nextReportId: 1 };
}

function newReportToken() {
  return crypto.randomBytes(20).toString('hex');
}

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const db = emptyDB();
    db.users.push({
      id: db.nextUserId++,
      username: 'officer',
      passwordHash: bcrypt.hashSync('officer123', 10),
      role: 'officer',
      firstName: 'קצין',
      lastName: 'רכב',
      vehicleNumber: '',
      leaseStartDate: ''
    });
    writeDB(db);
    return db;
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  let changed = false;
  db.users.forEach(u => {
    if (u.role === 'employee' && !u.reportToken) {
      u.reportToken = newReportToken();
      changed = true;
    }
  });
  if (changed) writeDB(db);
  return db;
}

function writeDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function getUserByUsername(username) {
  const db = readDB();
  return db.users.find(u => u.username === username);
}

function getUserById(id) {
  const db = readDB();
  return db.users.find(u => u.id === Number(id));
}

function getEmployeeByReportToken(token) {
  const db = readDB();
  return db.users.find(u => u.role === 'employee' && u.reportToken === token);
}

function listEmployees() {
  const db = readDB();
  return db.users.filter(u => u.role === 'employee');
}

function createEmployee({ firstName, lastName, vehicleNumber, manufacturer, model, year, leaseStartDate, phone, email, username, password }) {
  const db = readDB();
  if (db.users.some(u => u.username === username)) {
    throw new Error('שם המשתמש כבר קיים במערכת');
  }
  const user = {
    id: db.nextUserId++,
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'employee',
    firstName,
    lastName,
    vehicleNumber,
    manufacturer: manufacturer || '',
    model: model || '',
    year: year || '',
    leaseStartDate,
    phone: phone || '',
    email: email || '',
    reportToken: newReportToken()
  };
  db.users.push(user);
  writeDB(db);
  return user;
}

function updateEmployee(id, { firstName, lastName, vehicleNumber, manufacturer, model, year, leaseStartDate, phone, email, username, password }) {
  const db = readDB();
  const user = db.users.find(u => u.id === Number(id) && u.role === 'employee');
  if (!user) throw new Error('העובד לא נמצא');
  if (username && username !== user.username && db.users.some(u => u.username === username)) {
    throw new Error('שם המשתמש כבר קיים במערכת');
  }
  user.firstName = firstName;
  user.lastName = lastName;
  user.vehicleNumber = vehicleNumber;
  user.manufacturer = manufacturer || '';
  user.model = model || '';
  user.year = year || '';
  user.leaseStartDate = leaseStartDate;
  user.phone = phone || '';
  user.email = email || '';
  if (username) user.username = username;
  if (password) user.passwordHash = bcrypt.hashSync(password, 10);
  writeDB(db);
  return user;
}

function regenerateReportToken(id) {
  const db = readDB();
  const user = db.users.find(u => u.id === Number(id) && u.role === 'employee');
  if (!user) throw new Error('העובד לא נמצא');
  user.reportToken = newReportToken();
  writeDB(db);
  return user;
}

function deleteEmployee(id) {
  const db = readDB();
  db.users = db.users.filter(u => !(u.id === Number(id) && u.role === 'employee'));
  db.reports = db.reports.filter(r => r.userId !== Number(id));
  writeDB(db);
}

function addReport({ userId, vehicleNumber, reportDate, mileage }) {
  const db = readDB();
  const report = {
    id: db.nextReportId++,
    userId: Number(userId),
    vehicleNumber,
    reportDate,
    mileage: Number(mileage),
    createdAt: new Date().toISOString()
  };
  db.reports.push(report);
  writeDB(db);
  return report;
}

function listReports({ userId } = {}) {
  const db = readDB();
  let reports = db.reports;
  if (userId) reports = reports.filter(r => r.userId === Number(userId));
  return reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function lastReportForUser(userId) {
  const reports = listReports({ userId });
  return reports[0] || null;
}

function listReportsWithUsers() {
  const db = readDB();
  const usersById = Object.fromEntries(db.users.map(u => [u.id, u]));
  return listReports().map(r => ({ ...r, user: usersById[r.userId] }));
}

module.exports = {
  getUserByUsername,
  getUserById,
  getEmployeeByReportToken,
  listEmployees,
  createEmployee,
  updateEmployee,
  regenerateReportToken,
  deleteEmployee,
  addReport,
  listReports,
  lastReportForUser,
  listReportsWithUsers
};
