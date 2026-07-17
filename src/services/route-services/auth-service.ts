import { AppError } from "../../helpers/error";
import { generateAccessToken, hashPassword, verifyPassword } from "../../helpers/password";
import { toSafeUser } from "../../helpers/user";
import { generateOtp, getOtpExpiry, isOtpExpired } from "../../helpers/otp";
import { sendOtpEmail, sendPasswordResetEmail } from "../email-service";
import prisma from "../../lib/prisma";
import {
    ForgotPasswordInput,
    LoginInput,
    ResetPasswordInput,
    SignupInput,
    VerifyEmailInput,
} from "../../schemas/auth.schema";
import { Role } from "@prisma/client";

export const signupService = async (payload: SignupInput) => {
    try {
        const { firstName, lastName, email, password } = payload;

        const existingUser = await prisma.user.findUnique({ where: { email }});
        if (existingUser) {
            throw new AppError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists');
        }

        const hashedPassword = await hashPassword(password);
        const otp = generateOtp();
        const otpExpiresAt = getOtpExpiry();

        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                name: `${firstName} ${lastName}`,
                email,
                password: hashedPassword,
                otp,
                otpExpiresAt,
                role: Role.User,
            },
        });

        try {
            await sendOtpEmail(user.email, otp);
        } catch (emailError: any) {
            // Account creation should still succeed even if the OTP email fails to send.
            console.error(`Failed to send signup OTP email to ${user.email}:`, emailError.message);
        }

        const { accessToken } = await generateAccessToken(user);

        return {
            user: toSafeUser(user),
            accessToken,
        };
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const verifyEmailService = async (payload: VerifyEmailInput) => {
    try {
        const { email, otp } = payload;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new AppError(404, 'NOT_FOUND', 'User account not found');
        }

        if (user.isVerified) {
            throw new AppError(400, 'ALREADY_VERIFIED', 'This account is already verified');
        }

        if (!user.otp || isOtpExpired(user.otpExpiresAt)) {
            throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired, please request a new one');
        }

        if (user.otp !== otp) {
            throw new AppError(400, 'INVALID_OTP', 'Invalid OTP');
        }

        const updated = await prisma.user.update({
            where: { email },
            data: { isVerified: true, otp: null, otpExpiresAt: null },
        });

        return toSafeUser(updated);
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const forgotPasswordService = async (payload: ForgotPasswordInput): Promise<{ message: string }> => {
    // Always return the same response, whether or not the account exists,
    // so this endpoint can't be used to enumerate registered emails.
    const genericResponse = { message: 'If an account exists for this email, a password reset code has been sent.' };

    try {
        const { email } = payload;
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
            const otp = generateOtp();
            const otpExpiresAt = getOtpExpiry();

            await prisma.user.update({ where: { email }, data: { otp, otpExpiresAt } });

            try {
                await sendPasswordResetEmail(email, otp);
            } catch (emailError: any) {
                console.error(`Failed to send password reset email to ${email}:`, emailError.message);
            }
        }

        return genericResponse;
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const resetPasswordService = async (payload: ResetPasswordInput) => {
    try {
        const { email, otp, newPassword } = payload;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new AppError(404, 'NOT_FOUND', 'User account not found');
        }

        if (!user.otp || isOtpExpired(user.otpExpiresAt)) {
            throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired, please request a new one');
        }

        if (user.otp !== otp) {
            throw new AppError(400, 'INVALID_OTP', 'Invalid OTP');
        }

        const hashedPassword = await hashPassword(newPassword);

        const updated = await prisma.user.update({
            where: { email },
            data: { password: hashedPassword, otp: null, otpExpiresAt: null },
        });

        return toSafeUser(updated);
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const loginService = async (payload: LoginInput) => {
    try {
        const { email, password } = payload;
        const existingUser = await prisma.user.findUnique({ where: { email }});

        if (!existingUser) {
            throw new AppError(404, 'NOT_FOUND', 'User account not found');
        }
        const isValidPassword = await verifyPassword(password, existingUser.password);
        if (!isValidPassword) {
            throw new AppError(400, 'INVALID_CRENDENTAIL', 'Incorrect Password');
        }

        const { accessToken } = await generateAccessToken(existingUser);

        return {
            user: toSafeUser(existingUser),
            accessToken
        };

    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}