import { FastifyInstance } from 'fastify';
import { authenticate, requireRole, ValidateSchema } from '../middlewares';
import {
  AddPoolMembersSchema,
  CreatePoolSchema,
  JoinPoolSchema,
  ListPoolsQuerySchema,
  PayPoolShareSchema,
  PoolIdParamsSchema,
  type AddPoolMembersInput,
  type JoinPoolInput,
  type ListPoolsQuery,
  type PayPoolShareInput,
  type PoolIdParams,
} from '../schemas/pool.schema';
import {
  addPoolMembersHandler,
  createPoolHandler,
  getPoolHandler,
  joinPoolHandler,
  listMyPoolsHandler,
  listPoolMembersHandler,
  listPoolsHandler,
  listPoolTransactionsHandler,
  payPoolShareHandler,
} from '../controllers/index';
import { Role } from '@prisma/client';

const poolProperties = {
  id: { type: 'string' },
  leaderId: { type: 'string' },
  leader: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string' },
    },
  },
  name: { type: 'string' },
  description: { type: ['string', 'null'] },
  categoryId: { type: 'string' },
  category: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: ['string', 'null'] },
      isActive: { type: 'boolean' },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
  },
  targetAmount: { type: 'number' },
  amountRaised: { type: 'number' },
  amountPerSlot: { type: 'number' },
  maxMembers: { type: 'number' },
  splitEven: { type: 'boolean' },
  memberShareAmountKobo: { type: 'number' },
  beneficiaryAccountNumber: { type: 'string' },
  beneficiaryBankName: { type: 'string' },
  beneficiaryBankCode: { type: ['string', 'null'] },
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

const transactionProperties = {
  id: { type: 'string' },
  poolId: { type: 'string' },
  membershipId: { type: 'string' },
  paymentReference: { type: 'string' },
  monnifyTransactionReference: { type: ['string', 'null'] },
  dynamicAccountNumber: { type: ['string', 'null'] },
  dynamicAccountBankCode: { type: ['string', 'null'] },
  dynamicAccountExpiresAt: { type: ['string', 'null'] },
  amountExpected: { type: 'number' },
  amountPaid: { type: ['number', 'null'] },
  sourceAccountNumber: { type: ['string', 'null'] },
  sourceBankCode: { type: ['string', 'null'] },
  sourceAccountName: { type: ['string', 'null'] },
  state: {
    type: 'string',
    enum: ['PENDING', 'PAID', 'OVERPAID', 'UNDERPAID', 'EXPIRED', 'FAILED'],
  },
  paidAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
  membership: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      state: { type: 'string' },
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
    },
  },
};

const refundProperties = {
  id: { type: 'string' },
  transactionId: { type: 'string' },
  poolId: { type: 'string' },
  membershipId: { type: 'string' },
  refundReference: { type: 'string' },
  monnifyRefundReference: { type: ['string', 'null'] },
  amount: { type: 'number' },
  destinationAccountNumber: { type: 'string' },
  destinationBankCode: { type: 'string' },
  state: {
    type: 'string',
    enum: ['INITIATED', 'COMPLETED', 'FAILED'],
  },
  finalizedAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
  membership: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      state: { type: 'string' },
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
    },
  },
};

const disbursementProperties = {
  id: { type: 'string' },
  poolId: { type: 'string' },
  disbursementReference: { type: 'string' },
  monnifyReference: { type: ['string', 'null'] },
  grossAmount: { type: 'number' },
  feeAmount: { type: 'number' },
  netAmount: { type: 'number' },
  destinationAccountNumber: { type: 'string' },
  destinationBankCode: { type: 'string' },
  destinationAccountName: { type: ['string', 'null'] },
  state: {
    type: 'string',
    enum: ['INITIATED', 'SUCCESS', 'FAILED', 'REVERSED'],
  },
  finalizedAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
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
            categoryId: { type: 'string', format: 'uuid' },
            targetAmount: { type: 'number' },
            maxMembers: { type: 'number' },
            splitEven: { type: 'boolean' },
            memberShareAmount: { type: 'number' },
            beneficiaryAccountNumber: { type: 'string', minLength: 10, maxLength: 20 },
            beneficiaryBankName: { type: 'string', maxLength: 255 },
            beneficiaryAccountName: { type: 'string', maxLength: 255 },
            beneficiaryBankCode: { type: 'string', minLength: 3, maxLength: 6 },
            beneficiaryUserId: { type: 'string', format: 'uuid' },
            deadlineAt: { type: 'string', format: 'date-time' },
          },
          required: ['name', 'targetAmount', 'maxMembers', 'beneficiaryAccountNumber', 'beneficiaryAccountName', 'beneficiaryBankName', 'categoryId', 'beneficiaryBankCode', 'deadlineAt'],
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

  // GET /pools — list all pools, optionally filtered by status and/or name search
  app.get<{ Querystring: ListPoolsQuery }>(
    '/pools',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(ListPoolsQuerySchema, 'query')],
      attachValidation: true,
      schema: {
        tags: ['Pools'],
        summary: 'List all pools',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['OPEN', 'ALMOSTFUL', 'CLOSED', 'FUNDED', 'DISBURSING', 'COMPLETED', 'EXPIRED', 'REFUNDING', 'REFUNDED'],
            },
            search: { type: 'string', maxLength: 255 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array', items: { type: 'object', properties: poolProperties } },
              message: { type: 'string' },
            },
          },
          400: { type: 'object', properties: errorProperties },
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

  // POST /pools/join — join a pool
  app.post<{ Body: JoinPoolInput }>(
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

  // POST /pools/pay — initiate the current member's payment (dynamic virtual account)
  app.post<{ Body: PayPoolShareInput }>(
    '/pools/pay',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(PayPoolShareSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Pools'],
        summary: "Initiate the current member's payment for a pool",
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
          },
          required: ['id', 'amount'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  transaction: { type: 'object', properties: transactionProperties },
                  merchantName: { type: 'string' },
                  checkoutUrl: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
          400: { type: 'object', properties: errorProperties },
          403: { type: 'object', properties: errorProperties },
          404: { type: 'object', properties: errorProperties },
          409: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    payPoolShareHandler,
  );

  // GET /pools/:id/transactions — a pool's full money ledger: payments,
  // refunds, and the beneficiary payout (members/leader/Admin only)
  app.get<{ Params: PoolIdParams }>(
    '/pools/:id/transactions',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(PoolIdParamsSchema, 'params')],
      attachValidation: true,
      schema: {
        tags: ['Pools'],
        summary: "List a pool's transactions, refunds, and beneficiary disbursement",
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
              data: {
                type: 'object',
                properties: {
                  transactions: { type: 'array', items: { type: 'object', properties: transactionProperties } },
                  refunds: { type: 'array', items: { type: 'object', properties: refundProperties } },
                  disbursement: { type: ['object', 'null'], properties: disbursementProperties },
                },
              },
              message: { type: 'string' },
            },
          },
          403: { type: 'object', properties: errorProperties },
          404: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    listPoolTransactionsHandler,
  );

  // POST /pools/add-members — leader hand-picks existing app users to add to their pool
  app.post<{ Body: AddPoolMembersInput }>(
    '/pools/add-members',
    {
      preHandler: [...requireAuth, requireRole(Role.Admin, Role.User), ValidateSchema(AddPoolMembersSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Pools'],
        summary: 'Add existing users to a pool (leader only)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 100 },
          },
          required: ['id', 'userIds'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  addedCount: { type: 'number' },
                  skippedUserIds: { type: 'array', items: { type: 'string' } },
                  memberships: { type: 'array', items: { type: 'object', properties: memberProperties } },
                },
              },
              message: { type: 'string' },
            },
          },
          400: { type: 'object', properties: errorProperties },
          403: { type: 'object', properties: errorProperties },
          404: { type: 'object', properties: errorProperties },
          409: { type: 'object', properties: errorProperties },
          ...authFailureResponses,
        },
      },
    },
    addPoolMembersHandler,
  );
}
