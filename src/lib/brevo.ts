import { BrevoClient } from '@getbrevo/brevo';
import { AppError } from '../helpers/error';

declare global {
  // eslint-disable-next-line no-var
  var __brevoClient: BrevoClient | undefined;
}

let client: BrevoClient | undefined = global.__brevoClient;

// Lazily created so a missing API key doesn't crash app startup —
// it only fails when something actually tries to send an email.
export const getBrevoClient = (): BrevoClient => {
  if (client) {
    return client;
  }

  const apiKey = process.env['BREVO_API_KEY'];
  if (!apiKey) {
    throw new AppError(500, 'BREVO_NOT_CONFIGURED', 'Brevo is not configured — set BREVO_API_KEY');
  }

  const sendTimeoutMs = parseInt(process.env['EMAIL_SEND_TIMEOUT_MS'] ?? '10000', 10);

  client = new BrevoClient({
    apiKey,
    timeoutInSeconds: Math.max(1, Math.ceil(sendTimeoutMs / 1000)),
    maxRetries: 0,
  });

  if (process.env['NODE_ENV'] !== 'production') {
    global.__brevoClient = client;
  }

  return client;
};
