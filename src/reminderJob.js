const db = require('./db');
const mailer = require('./mailer');

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function buildMessage(employee, baseUrl) {
  const reportUrl = `${baseUrl}/report/${employee.reportToken}`;
  const subject = "תזכורת: עדכון קילומטראז' חודשי";
  const text = `שלום ${employee.firstName},\n\nנא לעדכן את קילומטראז' הרכב (${employee.vehicleNumber}) לחודש הנוכחי דרך הקישור הבא:\n${reportUrl}\n\nתודה,\nקצין הרכב`;
  const html = `<p>שלום ${escapeHtml(employee.firstName)},</p>
<p>נא לעדכן את קילומטראז' הרכב (<strong>${escapeHtml(employee.vehicleNumber)}</strong>) לחודש הנוכחי דרך הקישור הבא:</p>
<p><a href="${reportUrl}">${reportUrl}</a></p>
<p>תודה,<br>קצין הרכב</p>`;
  return { subject, text, html, reportUrl };
}

async function sendMonthlyReminders(baseUrl) {
  const employees = db.listEmployees();
  const results = { sent: [], skipped: [], failed: [] };

  for (const emp of employees) {
    if (!emp.email) {
      results.skipped.push(emp);
      continue;
    }
    const { subject, text, html } = buildMessage(emp, baseUrl);
    try {
      await mailer.sendMail({ to: emp.email, subject, text, html });
      results.sent.push(emp);
    } catch (err) {
      results.failed.push({ employee: emp, error: err.message });
    }
  }

  return results;
}

module.exports = { sendMonthlyReminders, buildMessage };
