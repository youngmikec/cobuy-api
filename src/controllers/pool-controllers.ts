import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import {
    addPoolMembersService,
    createPoolService,
    getPoolByIdService,
    joinPoolService,
    listMyPoolsService,
    listPoolMembersService,
    listPoolsService,
} from "../services/route-services/pool-service";
import { AddPoolMembersInput, CreatePoolInput, JoinPoolInput, ListPoolsQuery, PoolIdParams } from "../schemas/pool.schema";

export const createPoolHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const leaderId = request.user.user.id;
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

export const listPoolsHandler = async (
    request: FastifyRequest<{ Querystring: ListPoolsQuery }>,
    reply: FastifyReply,
) => {
    try {
        const pools = await listPoolsService(request.query);

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
        const userId = request.user.user.id;
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
    request: FastifyRequest<{ Body: JoinPoolInput }>,
    reply: FastifyReply,
) => {
    try {
        const userId = request.user.user.id;
        const membership = await joinPoolService(userId, request.body.id);

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

export const addPoolMembersHandler = async (
    request: FastifyRequest<{ Body: AddPoolMembersInput }>,
    reply: FastifyReply,
) => {
    try {
        const leaderId = request.user.user.id;
        const result = await addPoolMembersService(leaderId, request.body.id, request.body.userIds);

        return reply.status(201).send({
            success: true,
            data: result,
            message: "Members added successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}
