const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const generateOtp = (): string => {
  const max = 10 ** OTP_LENGTH;
  return Math.floor(Math.random() * max).toString().padStart(OTP_LENGTH, '0');
};

export const getOtpExpiry = (): Date => {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
};

export const isOtpExpired = (expiresAt: Date | null): boolean => {
  if (!expiresAt) {
    return true;
  }
  return expiresAt.getTime() < Date.now();
};

// There's no dedicated "otp sent at" column, but every OTP is issued with the
// same fixed TTL, so the issue time can be derived by walking otpExpiresAt
// back by that TTL. Used to throttle resend-otp without blocking on expiry.
export const getOtpResendCooldownRemainingSeconds = (expiresAt: Date | null): number => {
  if (!expiresAt) {
    return 0;
  }
  const issuedAt = expiresAt.getTime() - OTP_TTL_MINUTES * 60 * 1000;
  const cooldownEndsAt = issuedAt + OTP_RESEND_COOLDOWN_SECONDS * 1000;
  const remainingMs = cooldownEndsAt - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
};
