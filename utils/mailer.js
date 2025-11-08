const nodemailer = require("nodemailer");

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Fallback to a no-op transporter to avoid crashes in dev
    return {
      sendMail: async () => {
        console.warn("[mailer] SMTP not configured. Skipping email send.");
      },
    };
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const transporter = buildTransporter();

async function sendMail(to, subject, html) {
  const from = process.env.SMTP_FROM || `NomadNest <no-reply@nomadnest>`;
  await transporter.sendMail({ from, to, subject, html });
}

module.exports = { sendMail };
