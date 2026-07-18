import { z } from 'zod';

export const ResolveBankAccountSchema = z.object({
  accountNumber: z
    .string({ required_error: 'Account number is required' })
    .regex(/^\d{10}$/, { message: 'Account number must be 10 digits' })
    .trim(),
  bankCode: z
    .string({ required_error: 'Bank code is required' })
    .min(1, { message: 'Bank code must not be empty' })
    .max(10, { message: 'Bank code must be at most 10 characters' })
    .trim(),
});

export type ResolveBankAccountInput = z.infer<typeof ResolveBankAccountSchema>;
