import { FastifyInstance } from 'fastify';
import { authenticate, requireRole, ValidateSchema } from '../middlewares';
import { ResolveBankAccountSchema, type ResolveBankAccountInput } from '../schemas/bank.schema';
import { listBanksHandler, resolveBankAccountHandler } from '../controllers/index';
import { Role } from '@prisma/client';

const bankProperties = {
  name: { type: 'string' },
  code: { type: 'string' },
  ussdTemplate: { type: ['string', 'null'] },
  baseUssdCode: { type: ['string', 'null'] },
  transferUssdTemplate: { type: ['string', 'null'] },
};

const bankAccountProperties = {
  accountNumber: { type: 'string' },
  accountName: { type: 'string' },
  bankCode: { type: 'string' },
};

const errorProperties = {
  success: { type: 'boolean' },
  data: { type: 'null' },
  message: { type: 'string' },
};

const requireAuth = [authenticate];

const authFailureResponses = {
  401: { type: 'object', properties: errorProperties },
};

export async function bankRoutes(app: FastifyInstance): Promise<void> {
  // GET /banks — list all banks supported by Monnify
  app.get(
    '/banks',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User)],
      schema: {
        tags: ['Banks'],
        summary: 'List all banks supported by Monnify',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array', items: { type: 'object', properties: bankProperties } },
              message: { type: 'string' },
            },
          },
          ...authFailureResponses,
        },
      },
    },
    listBanksHandler,
  );

  // GET /banks/name-lookup — look up the account holder's name for a bank account number
  app.get<{ Querystring: ResolveBankAccountInput }>(
    '/banks/name-lookup',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(ResolveBankAccountSchema, 'query')],
      // Only used to generate Swagger docs — actual validation/error
      // formatting is still owned by ValidateSchema above.
      attachValidation: true,
      schema: {
        tags: ['Banks'],
        summary: "Resolve a bank account number to its account holder's name",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            accountNumber: { type: 'string', minLength: 10, maxLength: 10 },
            bankCode: { type: 'string', maxLength: 10 },
          },
          required: ['accountNumber', 'bankCode'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: bankAccountProperties },
              message: { type: 'string' },
            },
          },
          400: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    resolveBankAccountHandler,
  );
}
