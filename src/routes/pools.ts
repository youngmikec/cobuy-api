import { FastifyInstance } from 'fastify';
import { authenticate, requireRole, ValidateSchema } from '../middlewares';
import {
  CreatePoolSchema,
  JoinPoolSchema,
  PoolIdParamsSchema,
  type PoolIdParams,
} from '../schemas/pool.schema';
import {
  createPoolHandler,
  getPoolHandler,
  joinPoolHandler,
  listMyPoolsHandler,
  listPoolMembersHandler,
  listPoolsHandler,
} from '../controllers/index';
import { Role } from '@prisma/client';

const poolProperties = {
  id: { type: 'string' },
  leaderId: { type: 'string' },
  name: { type: 'string' },
  description: { type: ['string', 'null'] },
  category: {
    type: 'string',
    enum: ['BulkPurchase', 'Ajo', 'Fundraising', 'Repair', 'Investment', 'GroupGift', 'Education', 'Custom'],
  },
  targetAmountKobo: { type: 'number' },
  amountRaisedKobo: { type: 'number' },
  maxMembers: { type: 'number' },
  splitEven: { type: 'boolean' },
  memberShareAmountKobo: { type: 'number' },
  beneficiaryAccountNumber: { type: 'string' },
  beneficiaryBankName: { type: 'string' },
  beneficiaryAccountName: { type: ['string', 'null'] },
  beneficiaryUserId: { type: ['string', 'null'] },
  shareToken: { type: 'string' },
  shareLink: { type: 'string' },
  deadlineAt: { type: 'string' },
  status: {
    type: 'string',
    enum: ['OPEN', 'ALMOSTFUL', 'CLOSED', 'FUNDED', 'DISBURSING', 'COMPLETED', 'EXPIRED', 'REFUNDING', 'REFUNDED'],
  },
  slotsRemaining: { type: 'number' },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
  stateChangedAt: { type: 'string' },
};

const joinPoolProperties = {
  id: { type: 'string' },
  bankName: { type: 'string' },
  bankCode: { type: 'string' },
  accountNumber: { type: 'string' },
  accountName: { type: 'string' },
  memberShareAmount: { type: 'number' },
}

const memberProperties = {
  id: { type: 'string' },
  poolId: { type: 'string' },
  userId: { type: 'string' },
  state: {
    type: 'string',
    enum: ['JOINED', 'AWAITING_PAYMENT', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED'],
  },
  joinedAt: { type: 'string' },
  user: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string' },
      avatar: { type: ['string', 'null'] },
    },
  },
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

export async function poolRoutes(app: FastifyInstance): Promise<void> {
  // POST /pools — create a pool
  app.post(
    '/pools',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(CreatePoolSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Pools'],
        summary: 'Create a pool',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 255 },
            description: { type: 'string', maxLength: 2000 },
            category: {
              type: 'string',
              enum: ['BulkPurchase', 'Ajo', 'Fundraising', 'Repair', 'Investment', 'GroupGift', 'Education', 'Custom'],
            },
            targetAmount: { type: 'number' },
            maxMembers: { type: 'number' },
            splitEven: { type: 'boolean' },
            memberShareAmount: { type: 'number' },
            beneficiaryAccountNumber: { type: 'string', minLength: 10, maxLength: 20 },
            beneficiaryBankName: { type: 'string', maxLength: 255 },
            beneficiaryUserId: { type: 'string', format: 'uuid' },
            deadlineAt: { type: 'string', format: 'date-time' },
          },
          required: ['name', 'targetAmount', 'maxMembers', 'beneficiaryAccountNumber', 'beneficiaryBankName', 'deadlineAt'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: poolProperties },
              message: { type: 'string' },
            },
          },
          ...authFailureResponses,
        },
      },
    },
    createPoolHandler,
  );

  // GET /pools — list all pools
  app.get(
    '/pools',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User)],
      schema: {
        tags: ['Pools'],
        summary: 'List all pools',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array', items: { type: 'object', properties: poolProperties } },
              message: { type: 'string' },
            },
          },
          ...authFailureResponses,
        },
      },
    },
    listPoolsHandler,
  );

  // GET /pools/mine — pools the current user belongs to (as leader or member)
  app.get(
    '/pools/mine',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User)],
      schema: {
        tags: ['Pools'],
        summary: "List the current user's pools",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array', items: { type: 'object', properties: poolProperties } },
              message: { type: 'string' },
            },
          },
          ...authFailureResponses,
        },
      },
    },
    listMyPoolsHandler,
  );

  // GET /pools/:id — get single pool
  app.get<{ Params: PoolIdParams }>(
    '/pools/:id',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(PoolIdParamsSchema, 'params')],
      attachValidation: true,
      schema: {
        tags: ['Pools'],
        summary: 'Get a pool by id',
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
              data: { type: 'object', properties: poolProperties },
              message: { type: 'string' },
            },
          },
          404: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    getPoolHandler,
  );

  // POST /pools/:id/join — join a pool
  app.post<{ Params: PoolIdParams }>(
    '/pools/join',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(JoinPoolSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Pools'],
        summary: 'Join a pool',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {...joinPoolProperties},
          required: ['id'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: memberProperties },
              message: { type: 'string' },
            },
          },
          400: { type: 'object', properties: errorProperties },
          404: { type: 'object', properties: errorProperties },
          409: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    joinPoolHandler,
  );

  // GET /pools/:id/members — list a pool's members
  app.get<{ Params: PoolIdParams }>(
    '/pools/:id/members',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(PoolIdParamsSchema, 'params')],
      attachValidation: true,
      schema: {
        tags: ['Pools'],
        summary: "List a pool's members",
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
              data: { type: 'array', items: { type: 'object', properties: memberProperties } },
              message: { type: 'string' },
            },
          },
          404: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    listPoolMembersHandler,
  );
}
