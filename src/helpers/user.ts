import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'password' | 'otp' | 'otpExpiresAt'>;

export const toSafeUser = (user: User): SafeUser => {
  const { password, otp, otpExpiresAt, ...safeUser } = user;
  return {...safeUser, id: user.id.toString()}; // Convert id to string
};
