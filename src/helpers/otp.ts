const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;

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
