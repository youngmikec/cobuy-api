import { getMailer } from './mailer';
import { getBrevoClient } from './brevo';
import { AppError } from '../helpers/error';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

const MAIL_FROM_EMAIL = process.env['MAIL_FROM_EMAIL'] ?? process.env['SMTP_FROM'] ?? 'no-reply@co-buy.com';
const MAIL_FROM_NAME = process.env['MAIL_FROM_NAME'] ?? 'Co-Buy';

class SmtpEmailProvider implements EmailProvider {
  async send({ to, subject, html }: EmailMessage): Promise<void> {
    await getMailer().sendMail({
      from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
  }
}

class BrevoEmailProvider implements EmailProvider {
  async send({ to, subject, html }: EmailMessage): Promise<void> {
    await getBrevoClient().transactionalEmails.sendTransacEmail({
      sender: { email: MAIL_FROM_EMAIL, name: MAIL_FROM_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });
  }
}

const providers: Record<string, () => EmailProvider> = {
  smtp: () => new SmtpEmailProvider(),
  brevo: () => new BrevoEmailProvider(),
};

let provider: EmailProvider | undefined;

// Selected once via EMAIL_PROVIDER ('smtp' | 'brevo', defaults to 'smtp') —
// swapping providers is a one-line .env change, no code change required.
export const getEmailProvider = (): EmailProvider => {
  if (provider) {
    return provider;
  }

  const kind = (process.env['EMAIL_PROVIDER'] ?? 'smtp').toLowerCase();
  console.log(`Using email provider: ${kind}`);
  const factory = providers[kind];
  console.log(`Email provider factory: ${factory ? 'found' : 'not found'}`, factory);

  if (!factory) {
    throw new AppError(
      500,
      'EMAIL_PROVIDER_INVALID',
      `Unknown EMAIL_PROVIDER '${kind}' — expected one of: ${Object.keys(providers).join(', ')}`,
    );
  }

  provider = factory();
  return provider;
};
