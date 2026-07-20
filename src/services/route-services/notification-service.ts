import { NotificationType } from "@prisma/client";
import { AppError } from "../../helpers/error";
import prisma from "../../lib/prisma";

// Internal helper — errors bubble up to whichever service/transaction
// called it (e.g. addPoolMembersService), matching the rest of this file.
export const createNotificationService = async (params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    poolId?: string;
}) => {
    return prisma.notification.create({
        data: {
            userId: params.userId,
            type: params.type,
            title: params.title,
            message: params.message,
            ...(params.poolId ? { poolId: params.poolId } : {}),
        },
    });
}

// Fans out the same notification to every member of a pool — best-effort,
// same pattern as the ADDED_TO_POOL loop in addPoolMembersService: one
// member's failure is logged and skipped rather than failing the caller.
export const notifyPoolMembersService = async (params: {
    poolId: string;
    type: NotificationType;
    title: string;
    message: string;
    excludeUserId?: string;
}) => {
    const members = await prisma.membership.findMany({
        where: {
            poolId: params.poolId,
            ...(params.excludeUserId ? { userId: { not: params.excludeUserId } } : {}),
        },
        select: { userId: true },
    });

    await Promise.all(
        members.map(async ({ userId }) => {
            try {
                await createNotificationService({
                    userId,
                    type: params.type,
                    title: params.title,
                    message: params.message,
                    poolId: params.poolId,
                });
            } catch (error: any) {
                console.error(`Failed to create ${params.type} notification for user ${userId}:`, error.message);
            }
        }),
    );
}

export const listNotificationsService = async (userId: string) => {
    try {
        return await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

// Admin-only: notifications across all users, optionally narrowed to one
// user via the userId query filter.
export const listAllNotificationsService = async (filterUserId?: string) => {
    try {
        return await prisma.notification.findMany({
            where: filterUserId ? { userId: filterUserId } : {},
            orderBy: { createdAt: 'desc' },
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const markNotificationReadService = async (userId: string, notificationId: string) => {
    try {
        const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
        if (!notification) {
            throw new AppError(404, 'NOT_FOUND', `Notification with id '${notificationId}' not found`);
        }
        if (notification.userId !== userId) {
            throw new AppError(403, 'FORBIDDEN', `You cannot modify another user's notification`);
        }
        if (notification.isRead) {
            return notification;
        }

        return await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true, readAt: new Date() },
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}
