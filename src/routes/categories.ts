import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { authenticate, requireRole, ValidateSchema } from '../middlewares';
import {
  CategoryIdParamsSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  type CategoryIdParams,
} from '../schemas/category.schema';
import {
  createCategoryHandler,
  deleteCategoryHandler,
  listActiveCategoriesHandler,
  updateCategoryHandler,
} from '../controllers/index';

const categoryProperties = {
  id: { type: 'string' },
  name: { type: 'string' },
  description: { type: ['string', 'null'] },
  isActive: { type: 'boolean' },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
};

const errorProperties = {
  success: { type: 'boolean' },
  data: { type: 'null' },
  message: { type: 'string' },
};

// Both roles can browse categories; only Admins manage them.
const requireAuth = [authenticate, requireRole(Role.Admin, Role.User)];
const requireAdmin = [authenticate, requireRole(Role.Admin)];

const authFailureResponses = {
  401: { type: 'object', properties: errorProperties },
  403: { type: 'object', properties: errorProperties },
};

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  // GET /categories — list active categories (Users and Admins)
  app.get(
    '/categories',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['Categories'],
        summary: 'List available (active) categories',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array', items: { type: 'object', properties: categoryProperties } },
              message: { type: 'string' },
            },
          },
          ...authFailureResponses,
        },
      },
    },
    listActiveCategoriesHandler,
  );

  // POST /categories — create a category (Admin only)
  app.post(
    '/categories',
    {
      preHandler: [...requireAdmin, ValidateSchema(CreateCategorySchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Categories'],
        summary: 'Create a category',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 100 },
            description: { type: 'string', maxLength: 2000 },
            isActive: { type: 'boolean' },
          },
          required: ['name'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: categoryProperties },
              message: { type: 'string' },
            },
          },
          409: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    createCategoryHandler,
  );

  // PUT /categories/:id — update a category (Admin only)
  app.put<{ Params: CategoryIdParams }>(
    '/categories/:id',
    {
      preHandler: [
        ...requireAdmin,
        ValidateSchema(CategoryIdParamsSchema, 'params'),
        ValidateSchema(UpdateCategorySchema, 'body'),
      ],
      attachValidation: true,
      schema: {
        tags: ['Categories'],
        summary: 'Update a category',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 100 },
            description: { type: 'string', maxLength: 2000 },
            isActive: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: categoryProperties },
              message: { type: 'string' },
            },
          },
          404: { type: 'object', properties: errorProperties },
          409: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    updateCategoryHandler,
  );

  // DELETE /categories/:id — delete a category (Admin only)
  app.delete<{ Params: CategoryIdParams }>(
    '/categories/:id',
    {
      preHandler: [...requireAdmin, ValidateSchema(CategoryIdParamsSchema, 'params')],
      attachValidation: true,
      schema: {
        tags: ['Categories'],
        summary: 'Delete a category',
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
    deleteCategoryHandler,
  );
}
