import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import {
    createUserService,
    deleteUserService,
    getUserByIdService,
    listUsersService,
    updateUserService,
} from "../services/route-services/user-service";
import { CreateUserInput, UpdateUserInput, UserIdParams } from "../schemas/user.schema";

export const listUsersHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
        const users = await listUsersService();

        return reply.status(200).send({
            success: true,
            data: users,
            message: "Users retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const getUserHandler = async (
    request: FastifyRequest<{ Params: UserIdParams }>,
    reply: FastifyReply,
) => {
    try {
        const user = await getUserByIdService(request.params.id);

        return reply.status(200).send({
            success: true,
            data: user,
            message: "User retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const createUserHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const user = await createUserService(request.body as CreateUserInput);

        return reply.status(201).send({
            success: true,
            data: user,
            message: "User created successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const updateUserHandler = async (
    request: FastifyRequest<{ Params: UserIdParams }>,
    reply: FastifyReply,
) => {
    try {
        const user = await updateUserService(request.params.id, request.body as UpdateUserInput);

        return reply.status(200).send({
            success: true,
            data: user,
            message: "User updated successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const deleteUserHandler = async (
    request: FastifyRequest<{ Params: UserIdParams }>,
    reply: FastifyReply,
) => {
    try {
        await deleteUserService(request.params.id);

        return reply.status(204).send();
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}
