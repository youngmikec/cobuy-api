import { z } from 'zod';
import { PoolStatus } from '@prisma/client';

export const CreatePoolSchema = z
  .object({
    name: z
      .string({ required_error: 'Name is required' })
      .min(1, { message: 'Name must not be empty' })
      .max(255, { message: 'Name must be at most 255 characters' })
      .trim(),
    description: z.string().max(2000).trim().optional(),
    // Defaults to the 'Custom' category when omitted — resolved in the service layer.
    categoryId: z.string().uuid({ message: 'Invalid category id' }).optional(),
    targetAmount: z
      .number({ required_error: 'Target amount is required' })
      .int()
      .positive({ message: 'Target amount must be greater than 0' }),
    maxMembers: z
      .number({ required_error: 'Max members is required' })
      .int()
      .positive({ message: 'Max members must be greater than 0' }),
    splitEven: z.boolean().optional().default(true),
    memberShareAmount: z.number().int().positive().optional(),
    beneficiaryAccountNumber: z
      .string({ required_error: 'Beneficiary account number is required' })
      .min(10, { message: 'Beneficiary account number looks too short' })
      .max(20)
      .trim(),
    beneficiaryBankName: z
      .string({ required_error: 'Beneficiary bank name is required' })
      .min(1)
      .max(255)
      .trim(),
    beneficiaryBankCode: z
      .string({ required_error: 'Beneficiary bank code is required' })
      .min(3)
      .max(6)
      .trim(),
    beneficiaryAccountName: z
      .string({ required_error: 'Beneficiary account name is required' })
      .min(1)
      .max(255)
      .trim(),
    beneficiaryUserId: z.string().uuid().optional(),
    deadlineAt: z.coerce.date({ required_error: 'Deadline is required' }),
  })
  .refine((data) => data.deadlineAt.getTime() > Date.now(), {
    message: 'Deadline must be in the future',
    path: ['deadlineAt'],
  })
  .refine((data) => data.splitEven || data.memberShareAmount !== undefined, {
    message: 'memberShareAmount is required when splitEven is false',
    path: ['memberShareAmount'],
  });

export const PoolIdParamsSchema = z.object({
  id: z.string({ required_error: 'Pool id is required' }).uuid({ message: 'Invalid pool id' }),
});

export const ListPoolsQuerySchema = z.object({
  status: z.nativeEnum(PoolStatus, { errorMap: () => ({ message: 'Invalid pool status' }) }).optional(),
  // Case-insensitive partial match against the pool name.
  search: z.string().trim().min(1).max(255).optional(),
});

export const JoinPoolSchema = z.object({
  id: z.string({ required_error: 'Pool id is required' }).uuid({ message: 'Invalid pool id' }),
  bankName: z.string({ required_error: 'Bank name is required' }).min(1).max(255).trim(),
  bankCode: z.string({ required_error: 'Bank code is required' }).min(3).max(6).trim(),
  accountNumber: z.string({ required_error: 'Account number is required' }).min(10).max(10).trim(),
  accountName: z.string({ required_error: 'Account name is required' }).min(1).max(255).trim(),
  memberShareAmount: z.number({ required_error: 'Member share amount is required' }).int().positive(),
});

export const PayPoolShareSchema = z.object({
  id: z.string({ required_error: 'Pool id is required' }).uuid({ message: 'Invalid pool id' }),
  amount: z
    .number({ required_error: 'Amount is required' })
    .int()
    .positive({ message: 'Amount must be greater than 0' }),
});

export type CreatePoolInput = z.infer<typeof CreatePoolSchema>;
export type PoolIdParams = z.infer<typeof PoolIdParamsSchema>;
export type JoinPoolInput = z.infer<typeof JoinPoolSchema>;
export type ListPoolsQuery = z.infer<typeof ListPoolsQuerySchema>;
export type PayPoolShareInput = z.infer<typeof PayPoolShareSchema>;