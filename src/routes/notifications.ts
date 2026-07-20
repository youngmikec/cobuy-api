import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { authenticate, requireRole, ValidateSchema } from '../middlewares';
import {
  ListNotificationsQuerySchema,
  NotificationIdParamsSchema,
  type ListNotificationsQuery,
  type NotificationIdParams,
} from '../schemas/notification.schema';
import { listAllNotificationsHandler, listNotificationsHandler, markNotificationReadHandler } from '../controllers/index';

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
const requireAdmin = [authenticate, requireRole(Role.Admin)];

const authFailureResponses = {
  401: { type: 'object', properties: errorProperties },
  403: { type: 'object', properties: errorProperties },
};

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // GET /notifications — Admin only: list notifications across all users,
  // optionally filtered to one user via ?userId=
  app.get<{ Querystring: ListNotificationsQuery }>(
    '/notifications',
    {
      preHandler: [...requireAdmin, ValidateSchema(ListNotificationsQuerySchema, 'query')],
      attachValidation: true,
      schema: {
        tags: ['Notifications'],
        summary: 'List notifications across all users (Admin only)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
          },
        },
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
    listAllNotificationsHandler,
  );

  // GET /notifications/mine — list the current user's notifications
  app.get(
    '/notifications/mine',
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
