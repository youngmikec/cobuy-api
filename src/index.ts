import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from "@fastify/jwt";
import rawBody from "fastify-raw-body";
import fastifyHelmet from "@fastify/helmet";
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { registerRoutes } from './routes/index';
import prisma from './lib/prisma';
import { AppError } from './helpers/error';
import { getRequiredEnv } from './helpers/env';
import { startPoolDeadlineJob, stopPoolDeadlineJob } from './jobs/pool-deadline-job';
import { initSocket, closeSocket } from './lib/socket';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const APP_BASE_URL = process.env['APP_BASE_URL'] ?? 'https://cobuy.app';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    // pino-pretty is a devDependency (not shipped in the production image),
    // so only use it when explicitly in development — anything else
    // (including a missing/misconfigured NODE_ENV) must fall back to the
    // plain JSON logger rather than crash trying to load a missing module.
    logger:
      NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }
        : true,
  });

  //Register JWT plugin
  await fastify.register(jwt, {
    secret: getRequiredEnv('JWT_SECRET'),
    sign: { expiresIn: `${process.env['JWT_ACCESS_TTL_MINUTES']}m` }
  });

  await fastify.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true
  });

  await fastify.register(fastifyHelmet, { contentSecurityPolicy: false });

  // API documentation
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Co-buy API',
        description: 'API documentation for the Co-buy platform',
        version: '1.0.0',
      },
      servers: [
        { url: `http://${HOST}:${PORT}`, description: 'Current server' },
        { url: `http://localhost:${PORT}`, description: 'Local development' },
        { url: APP_BASE_URL, description: 'Production' },
      ],
      tags: [
        { name: 'Health', description: 'Service health checks' },
        { name: 'Users', description: 'User management' },
        { name: 'Auth', description: 'Authentication' },
        { name: 'Pools', description: 'Pool creation, membership, and listing' },
        { name: 'Banks', description: 'Bank list and account resolution (Monnify)' },
        { name: 'Categories', description: 'Pool categories' },
        { name: 'Webhooks', description: 'Inbound Monnify webhook events' },
        { name: 'Notifications', description: 'In-app user notifications' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  // Register CORS
  await fastify.register(cors, {
    origin: NODE_ENV === 'production' ? false : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Register all routes
  await registerRoutes(fastify);

  // 404 handler
  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      success: false,
      data: null,
      message: 'Route not found',
    });
  });

  // Global error handler
  fastify.setErrorHandler<FastifyError | AppError>((error, _request, reply) => {
    if (error instanceof AppError) {
      fastify.log.error({ error }, 'AppError occurred');
      return reply.status(error.statusCode).send({
        success: false,
        data: null,
        message: error.message,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        data: null,
        message: error.validation,
        // details: error.validation,
      });
    }

    fastify.log.error({ err: error });
    const statusCode = typeof (error as { statusCode?: number }).statusCode === "number"
      ? (error as { statusCode?: number }).statusCode ?? 500
      : 500;
    const message = error instanceof Error ? error.message : "Unexpected error";
    reply.status(statusCode).send({
      success: false,
      data: null,
      code: statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message: statusCode >= 500 ? "Internal server error" : message,
      requestId: _request.id
    });
  });

  return fastify;
}

async function start(): Promise<void> {
  const fastify = await buildApp();

  // Attached here (not inside buildApp()) since buildApp() is also called as
  // a throwaway JWT sign/verify helper from src/helpers/password.ts on
  // nearly every request — doing this there would spin up a redundant
  // socket.io server on every one of those calls.
  initSocket(fastify);

  // Graceful shutdown handler
  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info(`Received ${signal}, starting graceful shutdown...`);
    try {
      stopPoolDeadlineJob();
      await closeSocket();
      await fastify.close();
      await prisma.$disconnect();
      fastify.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Server running in ${NODE_ENV} mode`);
    startPoolDeadlineJob();
  } catch (err) {
    fastify.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void start();
