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
