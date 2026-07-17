import z from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email({ message: 'Invalid email address' })
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(255, { message: 'Password must be at most 255 characters long' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required' })
    .min(1, { message: 'First name must not be empty' })
    .max(255, { message: 'First name must be at most 255 characters' })
    .trim(),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .min(1, { message: 'Last name must not be empty' })
    .max(255, { message: 'Last name must be at most 255 characters' })
    .trim(),
  email: z
    .string({ required_error: 'Email is required' })
    .email({ message: 'Invalid email address' })
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(255, { message: 'Password must be at most 255 characters long' }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const verifyEmailSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email({ message: 'Invalid email address' })
    .toLowerCase()
    .trim(),
  otp: z
    .string({ required_error: 'OTP is required' })
    .length(6, { message: 'OTP must be 6 digits' }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email({ message: 'Invalid email address' })
    .toLowerCase()
    .trim(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email({ message: 'Invalid email address' })
    .toLowerCase()
    .trim(),
  otp: z
    .string({ required_error: 'OTP is required' })
    .length(6, { message: 'OTP must be 6 digits' }),
  newPassword: z
    .string({ required_error: 'New password is required' })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(255, { message: 'Password must be at most 255 characters long' }),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;