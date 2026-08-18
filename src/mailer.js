const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!isConfigured()) {
    throw new Error('שליחת מייל לא הוגדרה (חסרים משתני הסביבה SMTP_USER / SMTP_PASS)');
  }
  const transport = buildTransport();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await transport.sendMail({ from, to, subject, text, html });
}

module.exports = { isConfigured, sendMail };
