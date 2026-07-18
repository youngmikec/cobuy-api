import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import {
    createPoolService,
    getPoolByIdService,
    joinPoolService,
    listMyPoolsService,
    listPoolMembersService,
    listPoolsService,
} from "../services/route-services/pool-service";
import { CreatePoolInput, PoolIdParams } from "../schemas/pool.schema";

export const createPoolHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const leaderId = request.user.id;
        const pool = await createPoolService(leaderId, request.body as CreatePoolInput);

        return reply.status(201).send({
            success: true,
            data: pool,
            message: "Pool created successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const listPoolsHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
        const pools = await listPoolsService();

        return reply.status(200).send({
            success: true,
            data: pools,
            message: "Pools retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const getPoolHandler = async (
    request: FastifyRequest<{ Params: PoolIdParams }>,
    reply: FastifyReply,
) => {
    try {
        const pool = await getPoolByIdService(request.params.id);

        return reply.status(200).send({
            success: true,
            data: pool,
            message: "Pool retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const listMyPoolsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const userId = request.user.id;
        const pools = await listMyPoolsService(userId);

        return reply.status(200).send({
            success: true,
            data: pools,
            message: "Your pools retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const joinPoolHandler = async (
    request: FastifyRequest<{ Params: PoolIdParams }>,
    reply: FastifyReply,
) => {
    try {
        const userId = request.user.id;
        const membership = await joinPoolService(userId, request.params.id);

        return reply.status(201).send({
            success: true,
            data: membership,
            message: "Joined pool successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const listPoolMembersHandler = async (
    request: FastifyRequest<{ Params: PoolIdParams }>,
    reply: FastifyReply,
) => {
    try {
        const members = await listPoolMembersService(request.params.id);

        return reply.status(200).send({
            success: true,
            data: members,
            message: "Pool members retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}
