import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(1, { message: 'Name must not be empty' })
    .max(100, { message: 'Name must be at most 100 characters' })
    .trim(),
  description: z.string().max(2000).trim().optional(),
  isActive: z.boolean().optional().default(true),
});

export const UpdateCategorySchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name must not be empty' })
    .max(100, { message: 'Name must be at most 100 characters' })
    .trim()
    .optional(),
  description: z.string().max(2000).trim().optional(),
  isActive: z.boolean().optional(),
});

export const CategoryIdParamsSchema = z.object({
  id: z.string({ required_error: 'Category id is required' }).uuid({ message: 'Invalid category id' }),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CategoryIdParams = z.infer<typeof CategoryIdParamsSchema>;
