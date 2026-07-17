import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { authenticate, requireRole, ValidateSchema } from '../middlewares';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserIdParamsSchema,
  type UserIdParams,
} from '../schemas/user.schema';
import {
  createUserHandler,
  deleteUserHandler,
  getUserHandler,
  listUsersHandler,
  updateUserHandler,
} from '../controllers/index';

// Shape returned for a user once password/otp have been stripped — see toSafeUser.
const userProperties = {
  id: { type: 'string' },
  avatar: { type: ['string', 'null'] },
  firstName: { type: 'string' },
  lastName: { type: 'string' },
  phone: { type: ['string', 'null'] },
  email: { type: 'string' },
  name: { type: 'string' },
  role: { type: 'string', enum: ['User', 'Admin'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
};

const errorProperties = {
  success: { type: 'boolean' },
  data: { type: 'null' },
  message: { type: 'string' },
};

// These endpoints manage user records directly (including role assignment),
// so they're restricted to authenticated Admin (backoffice) callers.
const requireAdmin = [authenticate, requireRole(Role.Admin)];

const authFailureResponses = {
  401: { type: 'object', properties: errorProperties },
  403: { type: 'object', properties: errorProperties },
};

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // GET /users — list all users
  app.get(
    '/users',
    {
      preHandler: requireAdmin,
      schema: {
        tags: ['Users'],
        summary: 'List all users',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array', items: { type: 'object', properties: userProperties } },
              message: { type: 'string' },
            },
          },
          ...authFailureResponses,
        },
      },
    },
    listUsersHandler,
  );

  // GET /users/:id — get single user
  app.get<{ Params: UserIdParams }>(
    '/users/:id',
    {
      preHandler: [...requireAdmin, ValidateSchema(UserIdParamsSchema, 'params')],
      // Only used to generate Swagger docs — actual validation/error
      // formatting is still owned by ValidateSchema above.
      attachValidation: true,
      schema: {
        tags: ['Users'],
        summary: 'Get a user by id',
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
              data: { type: 'object', properties: userProperties },
              message: { type: 'string' },
            },
          },
          404: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    getUserHandler,
  );

  // POST /users — create a user
  app.post(
    '/users',
    {
      preHandler: [...requireAdmin, ValidateSchema(CreateUserSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Users'],
        summary: 'Create a user',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string', maxLength: 255 },
            lastName: { type: 'string', maxLength: 255 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8, maxLength: 255 },
            role: { type: 'string', enum: ['User', 'Admin'] },
          },
          required: ['firstName', 'lastName', 'email', 'password'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: userProperties },
              message: { type: 'string' },
            },
          },
          409: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    createUserHandler,
  );

  // PUT /users/:id — update a user
  app.put<{ Params: UserIdParams }>(
    '/users/:id',
    {
      preHandler: [
        ...requireAdmin,
        ValidateSchema(UserIdParamsSchema, 'params'),
        ValidateSchema(UpdateUserSchema, 'body'),
      ],
      attachValidation: true,
      schema: {
        tags: ['Users'],
        summary: 'Update a user',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string', maxLength: 255 },
            lastName: { type: 'string', maxLength: 255 },
            email: { type: 'string', format: 'email' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: userProperties },
              message: { type: 'string' },
            },
          },
          404: { type: 'object', properties: errorProperties },
          409: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    updateUserHandler,
  );

  // DELETE /users/:id — delete a user
  app.delete<{ Params: UserIdParams }>(
    '/users/:id',
    {
      preHandler: [...requireAdmin, ValidateSchema(UserIdParamsSchema, 'params')],
      attachValidation: true,
      schema: {
        tags: ['Users'],
        summary: 'Delete a user',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        response: {
          204: { type: 'null' },
          404: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    deleteUserHandler,
  );
}
