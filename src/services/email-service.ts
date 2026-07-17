import { getMailer } from '../lib/mailer';
import { AppError } from '../helpers/error';

const MAIL_FROM = process.env['SMTP_FROM'] ?? 'no-reply@co-buy.com';

const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
  try {
    const mailer = getMailer();
    await mailer.sendMail({ from: MAIL_FROM, to, subject, html });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(500, 'EMAIL_SEND_FAILED', `Failed to send email: ${error.message}`);
  }
};

export const sendOtpEmail = async (to: string, otp: string): Promise<void> => {
  await sendMail(
    to,
    'Verify your email',
    `<p>Your verification code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  );
};

export const sendPasswordResetEmail = async (to: string, otp: string): Promise<void> => {
  await sendMail(
    to,
    'Reset your password',
    `<p>Your password reset code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  );
};
