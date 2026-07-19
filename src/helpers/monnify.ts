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
