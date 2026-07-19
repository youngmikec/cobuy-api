import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import { initiatePoolPaymentService, listPoolTransactionsService } from "../services/route-services/transaction-service";
import { PayPoolShareInput, PoolIdParams } from "../schemas/pool.schema";

export const payPoolShareHandler = async (
    request: FastifyRequest<{ Body: PayPoolShareInput }>,
    reply: FastifyReply,
) => {
    try {
        const userId = request.user.user.id;
        const { id: poolId, amount } = request.body;
        const transaction = await initiatePoolPaymentService(userId, poolId, amount);

        return reply.status(201).send({
            success: true,
            data: transaction,
            message: "Payment initiated successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const listPoolTransactionsHandler = async (
    request: FastifyRequest<{ Params: PoolIdParams }>,
    reply: FastifyReply,
) => {
    try {
        const transactions = await listPoolTransactionsService(request.params.id);

        return reply.status(200).send({
            success: true,
            data: transactions,
            message: "Pool transactions retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}
