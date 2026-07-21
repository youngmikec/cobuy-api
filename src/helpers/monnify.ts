import crypto from 'crypto';

export const generateMonnifyBase64AuthKey = (apiKey: string, secretKey: string): string => {
  const credentials: string = `${apiKey}:${secretKey}`;
  const base64String: string = Buffer.from(credentials).toString('base64');
  return base64String;
}

// Monnify's API always deals in kobo; the rest of Co-Buy stores amounts in
// Naira (see Pool.targetAmount/memberShareAmount) — convert only at this boundary.
export const toKobo = (naira: number): number => Math.round(naira * 100);
export const fromKobo = (kobo: number): number => Math.round(kobo / 100);

// Per Monnify's docs: the `monnify-signature` header is only sent on webhooks
// fired with production keys — sandbox notifications never include it, so
// signature verification only makes sense once MONNIFY_ENV=production.
export const isMonnifyProduction = (): boolean =>
  (process.env['MONNIFY_ENV'] ?? 'sandbox').toLowerCase() === 'production';

// Monnify signs every webhook with HMAC-SHA512 over the raw request body,
// keyed with the account's secret key — verify before trusting any payload.
export const verifyMonnifyWebhookSignature = (rawBody: string, signature: string | undefined): boolean => {
  if (!signature) {
    return false;
  }

  const secretKey = process.env['MONNIFY_SECRET_KEY'] ?? '';
  const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');

  // Constant-time comparison to avoid leaking signature bytes via timing.
  const expected = Buffer.from(hash, 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
};

// axios's error.message on a non-2xx response is just the generic HTTP
// status text ("Request failed with status code 400") — Monnify's actual
// reason (responseMessage/responseCode) lives in the response body instead.
// Use this in every catch around a Monnify API call so logs show the real
// cause of a failure, not just the status code.
export const describeMonnifyError = (error: any): string => {
  const data = error?.response?.data;
  if (data?.responseMessage) {
    return `${data.responseMessage}${data.responseCode ? ` (${data.responseCode})` : ''}`;
  }
  return error?.message ?? String(error);
};
