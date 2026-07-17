import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import { AppError } from '../helpers/error';

dotenv.config();

declare global {
  // eslint-disable-next-line no-var
  var __mailer: Transporter | undefined;
}

let mailer: Transporter | undefined = global.__mailer;

// Lazily created so a missing SMTP config doesn't crash app startup —
// it only fails when something actually tries to send an email.
export const getMailer = (): Transporter => {
  if (mailer) {
    return mailer;
  }

  const host = process.env['SMTP_HOST'];
  const port = parseInt(process.env['SMTP_PORT'] ?? '587', 10);
  const secure = process.env['SMTP_SECURE'] === 'true';
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'];

  if (!host || !user || !pass) {
    throw new AppError(
      500,
      'SMTP_NOT_CONFIGURED',
      'SMTP is not configured — set SMTP_HOST, SMTP_USER and SMTP_PASS',
    );
  }

  mailer = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  if (process.env['NODE_ENV'] !== 'production') {
    global.__mailer = mailer;
  }

  return mailer;
};
