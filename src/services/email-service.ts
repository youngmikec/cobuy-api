import { getEmailProvider } from '../lib/email-provider';
import { AppError } from '../helpers/error';
import { withTimeout } from '../helpers/timeout';

const SEND_TIMEOUT_MS = parseInt(process.env['EMAIL_SEND_TIMEOUT_MS'] ?? '10000', 10);

const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
  try {
    await withTimeout(
      getEmailProvider().send({ to, subject, html }),
      SEND_TIMEOUT_MS,
      `Email to ${to} did not send within ${SEND_TIMEOUT_MS}ms`,
    );
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
