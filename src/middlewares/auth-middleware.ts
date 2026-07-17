import type { FastifyReply, FastifyRequest } from "fastify";
import { Role } from "@prisma/client";
import { AppError } from "../helpers/error";

export const authenticate = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or missing access token');
  }
};

export const requireRole = (...allowedRoles: Role[]) => {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const role = request.user?.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }
  };
};
