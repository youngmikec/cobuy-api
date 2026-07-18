import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { userRoutes } from './users';
import { authRoutes } from './auth';
import { poolRoutes } from './pools';
import { bankRoutes } from './banks';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check routes (no prefix)
  await fastify.register(healthRoutes);

  // API v1 routes
  await fastify.register(async (api: FastifyInstance) => {
      await api.register(userRoutes);
      await api.register(authRoutes);
      await api.register(poolRoutes);
      await api.register(bankRoutes);
    },
    { prefix: '/api/v1' },
  );
}
