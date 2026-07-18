import type { FastifyReply, FastifyRequest } from "fastify";
import { Role } from "@prisma/client";

export const authenticate = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
  try {
    const token = request.headers['authorization']?.split(' ')[1];
    if (!token) {
      _reply.status(401).send({
        success: false,
        data: null,
        message: 'Missing access token',
      });
    }
    const decoded: any = await request.jwtVerify();

    if (!decoded || !decoded.user) {
      _reply.status(401).send({
        success: false,
        data: null,
        message: 'Invalid access token',
      });
    }

    if (!decoded.user.id) {
      _reply.status(401).send({
        success: false,
        data: null,
        message: 'Invalid access token',
      });
    }

    if (decoded.type !== 'access') {
      _reply.status(401).send({
        success: false,
        data: null,
        message: 'Invalid token type',
      });
    }

    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      _reply.status(401).send({
        success: false,
        data: null,
        message: 'Access token has expired',
      });
    }
    request.user = decoded.user;
  } catch (error: any) {
    _reply.status(401).send({
      success: false,
      data: null,
      message: error.message || 'Invalid access token',
    });
  }
};

export const requireRole = (...allowedRoles: Role[]) => {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user: any = request.user;
    const role = user?.role;

    if (!role || !allowedRoles.includes(role)) {
      _reply.status(403).send({
        success: false,
        data: null,
        message: 'You do not have permission to perform this action',
      });
    }
  };
};
