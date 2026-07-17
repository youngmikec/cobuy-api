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
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

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
      servers: [{ url: `http://${HOST}:${PORT}`, description: 'Current server' }],
      tags: [
        { name: 'Health', description: 'Service health checks' },
        { name: 'Users', description: 'User management' },
        { name: 'Auth', description: 'Authentication' },
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
  fastify.setErrorHandler<FastifyError>((error, _request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        data: null,
        message: error.validation,
        // details: error.validation,
      });
    }

    // Known application errors — safe to expose message
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        data: null,
        message: error.message,
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? 'Internal Server Error' : error.name,
      message: NODE_ENV === 'production' && statusCode === 500
        ? 'An unexpected error occurred'
        : error.message,
    });
  });

  return fastify;
}

async function start(): Promise<void> {
  const fastify = await buildApp();

  // Graceful shutdown handler
  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info(`Received ${signal}, starting graceful shutdown...`);
    try {
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
  } catch (err) {
    fastify.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void start();
