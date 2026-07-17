import { AppError } from "../../helpers/error";
import { toSafeUser } from "../../helpers/user";
import { hashPassword } from "../../helpers/password";
import prisma from "../../lib/prisma";
import { CreateUserInput, UpdateUserInput } from "../../schemas/user.schema";

// Placeholder OTP until a real generation/verification flow is implemented.
const DEFAULT_OTP = '0000';

export const listUsersService = async () => {
    try {
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        return users.map(toSafeUser);
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const getUserByIdService = async (id: string) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new AppError(404, 'NOT_FOUND', `User with id '${id}' not found`);
        }
        return toSafeUser(user);
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const createUserService = async (payload: CreateUserInput) => {
    try {
        const { firstName, lastName, email, password, role } = payload;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new AppError(409, 'CONFLICT', `A user with email '${email}' already exists`);
        }

        const hashedPassword = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                name: `${firstName} ${lastName}`,
                email,
                password: hashedPassword,
                otp: DEFAULT_OTP,
                role,
            },
        });

        return toSafeUser(user);
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const updateUserService = async (id: string, payload: UpdateUserInput) => {
    try {
        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'NOT_FOUND', `User with id '${id}' not found`);
        }

        if (payload.email && payload.email !== existing.email) {
            const emailTaken = await prisma.user.findUnique({ where: { email: payload.email } });
            if (emailTaken) {
                throw new AppError(409, 'CONFLICT', `A user with email '${payload.email}' already exists`);
            }
        }

        const data = Object.fromEntries(
            Object.entries(payload).filter(([, v]) => v !== undefined),
        ) as { firstName?: string; lastName?: string; email?: string };

        const updated = await prisma.user.update({ where: { id }, data });
        return toSafeUser(updated);
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const deleteUserService = async (id: string): Promise<void> => {
    try {
        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'NOT_FOUND', `User with id '${id}' not found`);
        }

        await prisma.user.delete({ where: { id } });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}
