const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function emptyDB() {
  return { users: [], reports: [], nextUserId: 1, nextReportId: 1 };
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
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(db) {
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

function listEmployees() {
  const db = readDB();
  return db.users.filter(u => u.role === 'employee');
}

function createEmployee({ firstName, lastName, vehicleNumber, leaseStartDate, username, password }) {
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
    leaseStartDate
  };
  db.users.push(user);
  writeDB(db);
  return user;
}

function updateEmployee(id, { firstName, lastName, vehicleNumber, leaseStartDate, username, password }) {
  const db = readDB();
  const user = db.users.find(u => u.id === Number(id) && u.role === 'employee');
  if (!user) throw new Error('העובד לא נמצא');
  if (username && username !== user.username && db.users.some(u => u.username === username)) {
    throw new Error('שם המשתמש כבר קיים במערכת');
  }
  user.firstName = firstName;
  user.lastName = lastName;
  user.vehicleNumber = vehicleNumber;
  user.leaseStartDate = leaseStartDate;
  if (username) user.username = username;
  if (password) user.passwordHash = bcrypt.hashSync(password, 10);
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
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  addReport,
  listReports,
  lastReportForUser,
  listReportsWithUsers
};
