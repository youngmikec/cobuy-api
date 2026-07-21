import { Server, Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type { Pool } from '@prisma/client';

// Singleton, mirroring src/lib/prisma.ts — set once in src/index.ts's start()
// (never from inside buildApp(), which is also called as a throwaway JWT
// sign/verify helper from src/helpers/password.ts on nearly every request).
let io: Server | undefined;

const SOCKET_CORS_ORIGIN = process.env['SOCKET_CORS_ORIGIN'] ?? '*';

// The JWT payload's `user` claim is the full Prisma User row, password hash
// included (see src/helpers/password.ts) — never stash more than the id.
const authenticateSocket = (fastify: FastifyInstance) => {
    return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
        try {
            const token = socket.handshake.auth?.['token'];
            if (!token || typeof token !== 'string') {
                return next(new Error('Missing access token'));
            }

            const decoded: any = fastify.jwt.verify(token);

            if (!decoded?.user?.id) {
                return next(new Error('Invalid access token'));
            }
            if (decoded.type !== 'access') {
                return next(new Error('Invalid token type'));
            }
            if (decoded.exp && Date.now() >= decoded.exp * 1000) {
                return next(new Error('Access token has expired'));
            }

            socket.data['userId'] = decoded.user.id as string;
            return next();
        } catch (error: any) {
            return next(new Error(error.message || 'Invalid access token'));
        }
    };
};

export const initSocket = (fastify: FastifyInstance): Server => {
    io = new Server(fastify.server, {
        cors: { origin: SOCKET_CORS_ORIGIN, methods: ['GET', 'POST'] },
        transports: ['websocket'],
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
        },
    });

    io.use(authenticateSocket(fastify));

    io.on('connection', (socket) => {
        const userId = socket.data['userId'] as string;
        socket.join(`user:${userId}`);

        socket.on('pool:subscribe', (payload: { poolId?: string }) => {
            if (payload?.poolId && typeof payload.poolId === 'string') {
                socket.join(`pool:${payload.poolId}`);
            }
        });

        socket.on('pool:unsubscribe', (payload: { poolId?: string }) => {
            if (payload?.poolId && typeof payload.poolId === 'string') {
                socket.leave(`pool:${payload.poolId}`);
            }
        });
    });

    return io;
};

export const closeSocket = async (): Promise<void> => {
    if (!io) {
        return;
    }
    const server = io;
    io = undefined;
    await new Promise<void>((resolve) => server.close(() => resolve()));
};

export const emitToUser = (userId: string, event: string, payload: unknown): void => {
    io?.to(`user:${userId}`).emit(event, payload);
};

export const emitToPool = (poolId: string, event: string, payload: unknown): void => {
    io?.to(`pool:${poolId}`).emit(event, payload);
};

// Shared shape for every "pool changed" broadcast — field names match the
// REST toPoolDto() response (src/helpers/pool.ts), including its
// slotsRemaining (plural) naming even though the Prisma column is
// slotRemaining (singular), so the client can reuse one type for both.
export const emitPoolUpdate = (pool: Pick<Pool, 'id' | 'status' | 'amountRaised' | 'slotRemaining' | 'targetAmount' | 'stateChangedAt'>): void => {
    emitToPool(pool.id, 'pool:update', {
        id: pool.id,
        status: pool.status,
        amountRaised: pool.amountRaised,
        slotsRemaining: pool.slotRemaining,
        targetAmount: pool.targetAmount,
        stateChangedAt: pool.stateChangedAt,
    });
};
