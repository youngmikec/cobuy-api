import { AppError } from "../../helpers/error";
import { generateAccessToken, generateRefreshToken, hashPassword, verifyPassword, verifyRefreshToken } from "../../helpers/password";
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

        // Send before persisting: if the OTP email fails or times out, no row
        // is left behind, so the caller can safely retry signup with the same
        // email instead of getting stuck on an unverifiable ACCOUNT_EXISTS account.
        await sendOtpEmail(email, otp);

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

        return {
            user: toSafeUser(user),
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
        const { refreshToken, jti } = await generateRefreshToken(existingUser);
        const hashedRefreshToken = await hashPassword(refreshToken);

        await prisma.refreshToken.create({
            data: {
                jti: jti,
                userId: existingUser.id,
                tokenHash: hashedRefreshToken,
                isRevoked: false,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + parseInt(process.env['JWT_REFRESH_TTL_HOURS'] ?? '24') * 60 * 60 * 1000),
            }
        })

        return {
            user: toSafeUser(existingUser),
            accessToken,
            refreshToken
        };

    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const refreshTokenService = async (refreshToken: string) => {
    try {
        const decoded = await verifyRefreshToken(refreshToken);
        const { jti, user } = decoded;

        const existingUser = await prisma.user.findUnique({ where: { id: user.id } });

        if (!existingUser) {
            throw new AppError(404, 'NOT_FOUND', 'User account not found');
        }

        const storedToken = await prisma.refreshToken.findUnique({ where: { jti, userId: user.id } });

        if (!storedToken || storedToken.isRevoked) {
            throw new AppError(401, 'INVALID_TOKEN', 'Refresh token is invalid or has been revoked');
        }

        const { accessToken } = await generateAccessToken(user);
        const { refreshToken: newRefreshToken, jti: newJti } = await generateRefreshToken(user);
        const hashedNewRefreshToken = await hashPassword(newRefreshToken);

        // Revoke the old refresh token and store the new one
        await prisma.$transaction([
            prisma.refreshToken.update({
                where: { jti, userId: user.id },
                data: { 
                    isRevoked: true,
                    updatedAt: new Date(),
                }
            }),
            prisma.refreshToken.create({
                data: {
                    jti: newJti,
                    userId: user.id,
                    tokenHash: hashedNewRefreshToken,
                    isRevoked: false,
                    expiresAt: new Date(Date.now() + parseInt(process.env['JWT_REFRESH_TTL_HOURS'] ?? '24') * 60 * 60 * 1000)
                }
            })
        ]);

        return {
            user: toSafeUser(existingUser),
            accessToken,
            refreshToken: newRefreshToken
        };
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}