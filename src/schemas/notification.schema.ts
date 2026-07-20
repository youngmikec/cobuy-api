import { z } from 'zod';

export const NotificationIdParamsSchema = z.object({
  id: z.string({ required_error: 'Notification id is required' }).uuid({ message: 'Invalid notification id' }),
});

export type NotificationIdParams = z.infer<typeof NotificationIdParamsSchema>;
