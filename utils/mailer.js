const nodemailer = require("nodemailer");

const hasMailerConfig =
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS;

const getTransporter = () => {
  if (!hasMailerConfig) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();

  if (!transporter) {
    return { skipped: true };
  }

  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
};

module.exports = {
  sendMail,
};
