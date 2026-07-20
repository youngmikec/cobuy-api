import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import { listAllNotificationsService, listNotificationsService, markNotificationReadService } from "../services/route-services/notification-service";
import { ListNotificationsQuery, NotificationIdParams } from "../schemas/notification.schema";

export const listNotificationsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const userId = request.user.user.id;
        const notifications = await listNotificationsService(userId);

        return reply.status(200).send({
            success: true,
            data: notifications,
            message: "Notifications retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

// Admin-only: list notifications across all users, optionally filtered to
// one user via ?userId=.
export const listAllNotificationsHandler = async (
    request: FastifyRequest<{ Querystring: ListNotificationsQuery }>,
    reply: FastifyReply,
) => {
    try {
        const notifications = await listAllNotificationsService(request.query.userId);

        return reply.status(200).send({
            success: true,
            data: notifications,
            message: "Notifications retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const markNotificationReadHandler = async (
    request: FastifyRequest<{ Params: NotificationIdParams }>,
    reply: FastifyReply,
) => {
    try {
        const userId = request.user.user.id;
        const notification = await markNotificationReadService(userId, request.params.id);

        return reply.status(200).send({
            success: true,
            data: notification,
            message: "Notification marked as read",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}
