import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import { listBanksService, resolveBankAccountService } from "../services/route-services/bank-service";
import { ResolveBankAccountInput } from "../schemas/bank.schema";

export const listBanksHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
        const banks = await listBanksService();

        return reply.status(200).send({
            success: true,
            data: banks,
            message: "Banks retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const resolveBankAccountHandler = async (
    request: FastifyRequest<{ Querystring: ResolveBankAccountInput }>,
    reply: FastifyReply,
) => {
    try {
        const accountInfo = await resolveBankAccountService(request.query);

        return reply.status(200).send({
            success: true,
            data: accountInfo,
            message: "Bank account resolved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}
