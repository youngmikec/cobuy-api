import { ZodType } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";

type ValidateTarget = "body" | "query" | "params";

export const ValidateSchema = (schema: ZodType, target: ValidateTarget = "body") => {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
        result.error.format()
      const errors = JSON.parse(result.error.message);

      return reply.status(400).send({
        status: "error",
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    // Attach parsed/coerced data back to request
    (req as any)[target] = result.data;
  };
};