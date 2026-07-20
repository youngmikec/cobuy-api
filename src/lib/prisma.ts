import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development (due to hot reloading)
const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
