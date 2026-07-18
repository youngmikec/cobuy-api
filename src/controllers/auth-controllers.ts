import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import {
    forgotPasswordService,
    loginService,
    refreshTokenService,
    resetPasswordService,
    signupService,
    verifyEmailService,
} from "../services/route-services/auth-service";
import {
    ForgotPasswordInput,
    LoginInput,
    ResetPasswordInput,
    SignupInput,
    VerifyEmailInput,
} from "../schemas/auth.schema";


export const loginHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const response = await loginService(request.body as LoginInput);

        return reply.status(200).send({
            success: true,
            data: response,
            message: "Login successful",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const refreshTokenHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { refreshToken } = request.body as { refreshToken: string };
        const response = await refreshTokenService(refreshToken);

        return reply.status(200).send({
            success: true,
            data: response,
            message: "Token refreshed successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const signupHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const response = await signupService(request.body as SignupInput);

        return reply.status(201).send({
            success: true,
            data: response,
            message: "Signup successful",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const verifyEmailHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const response = await verifyEmailService(request.body as VerifyEmailInput);

        return reply.status(200).send({
            success: true,
            data: response,
            message: "Email verified successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const forgotPasswordHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const response = await forgotPasswordService(request.body as ForgotPasswordInput);

        return reply.status(200).send({
            success: true,
            data: null,
            message: response.message,
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const resetPasswordHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const response = await resetPasswordService(request.body as ResetPasswordInput);

        return reply.status(200).send({
            success: true,
            data: response,
            message: "Password reset successful",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}