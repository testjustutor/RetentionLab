const nodemailer = require('nodemailer');
const { logger } = require('./logger');
const EmailLogModel = require('../models/email/EmailLogModel');

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

async function sendMail({ to, subject, text, html, purpose = 'general' }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const transport = getTransport();

  if (!transport) {
    const errorMsg = 'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.';
    await EmailLogModel.log({
      sender_email: from || 'not-configured',
      receiver_email: to,
      subject,
      purpose,
      status: 'failed',
      error_message: errorMsg
    });
    throw new Error(errorMsg);
  }

  // Log attempt
  const logId = await EmailLogModel.log({
    sender_email: from,
    receiver_email: to,
    subject,
    purpose,
    status: 'pending'
  });

  try {
    const info = await transport.sendMail({ from, to, subject, text, html });
    
    // Update log to sent
    await EmailLogModel.log({
      sender_email: from,
      receiver_email: to,
      subject,
      purpose,
      status: 'sent'
    });
    
    logger.info(`Mailer: sent message to ${to} (${info.messageId || 'no-message-id'})`);
    return info;
  } catch (error) {
    // Update log to failed
    await EmailLogModel.log({
      sender_email: from,
      receiver_email: to,
      subject,
      purpose,
      status: 'failed',
      error_message: error.message
    });
    
    logger.error(`Mailer: failed to send message to ${to}:`, error);
    throw error;
  }
}

module.exports = { sendMail };
