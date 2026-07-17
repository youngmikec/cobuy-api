import { z } from 'zod';
import { Role } from '@prisma/client';

export const CreateUserSchema = z.object({
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
  role: z.nativeEnum(Role).optional().default(Role.User),
});

export const UpdateUserSchema = z.object({
  firstName: z
    .string()
    .min(1, { message: 'First name must not be empty' })
    .max(255, { message: 'First name must be at most 255 characters' })
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, { message: 'Last name must not be empty' })
    .max(255, { message: 'Last name must be at most 255 characters' })
    .trim()
    .optional(),
  email: z
    .string()
    .email({ message: 'Invalid email address' })
    .toLowerCase()
    .trim()
    .optional(),
});

export const UserIdParamsSchema = z.object({
  id: z.string({ required_error: 'User id is required' }).uuid({ message: 'Invalid user id' }),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserIdParams = z.infer<typeof UserIdParamsSchema>;
