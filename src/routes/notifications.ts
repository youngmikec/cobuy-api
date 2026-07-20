import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { authenticate, requireRole, ValidateSchema } from '../middlewares';
import { NotificationIdParamsSchema, type NotificationIdParams } from '../schemas/notification.schema';
import { listNotificationsHandler, markNotificationReadHandler } from '../controllers/index';

const notificationProperties = {
  id: { type: 'string' },
  userId: { type: 'string' },
  type: { type: 'string', enum: ['ADDED_TO_POOL'] },
  title: { type: 'string' },
  message: { type: 'string' },
  poolId: { type: ['string', 'null'] },
  isRead: { type: 'boolean' },
  readAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
};

const errorProperties = {
  success: { type: 'boolean' },
  data: { type: 'null' },
  message: { type: 'string' },
};

const requireAuth = [authenticate, requireRole(Role.Admin, Role.User)];

const authFailureResponses = {
  401: { type: 'object', properties: errorProperties },
  403: { type: 'object', properties: errorProperties },
};

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // GET /notifications — list the current user's notifications
  app.get(
    '/notifications',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['Notifications'],
        summary: "List the current user's notifications",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array', items: { type: 'object', properties: notificationProperties } },
              message: { type: 'string' },
            },
          },
          ...authFailureResponses,
        },
      },
    },
    listNotificationsHandler,
  );

  // PATCH /notifications/:id/read — mark a notification as read
  app.patch<{ Params: NotificationIdParams }>(
    '/notifications/:id/read',
    {
      preHandler: [...requireAuth, ValidateSchema(NotificationIdParamsSchema, 'params')],
      attachValidation: true,
      schema: {
        tags: ['Notifications'],
        summary: 'Mark a notification as read',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: notificationProperties },
              message: { type: 'string' },
            },
          },
          404: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    markNotificationReadHandler,
  );
}
