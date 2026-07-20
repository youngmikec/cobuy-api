import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import { listNotificationsService, markNotificationReadService } from "../services/route-services/notification-service";
import { NotificationIdParams } from "../schemas/notification.schema";

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
