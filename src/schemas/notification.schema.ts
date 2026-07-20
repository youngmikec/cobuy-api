import { z } from 'zod';

export const NotificationIdParamsSchema = z.object({
  id: z.string({ required_error: 'Notification id is required' }).uuid({ message: 'Invalid notification id' }),
});

export type NotificationIdParams = z.infer<typeof NotificationIdParamsSchema>;

// Admin-only filter — omit to list notifications across all users.
export const ListNotificationsQuerySchema = z.object({
  userId: z.string().uuid({ message: 'Invalid user id' }).optional(),
});

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;
