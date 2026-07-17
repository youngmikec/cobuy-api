import { FastifyInstance } from "fastify";
import { ValidateSchema } from "../middlewares";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from "../schemas/auth.schema";
import {
  forgotPasswordHandler,
  loginHandler,
  resetPasswordHandler,
  signupHandler,
  verifyEmailHandler,
} from "../controllers/index";

// Response shape produced by both loginHandler and signupHandler.
const authResponseSchema = {
  200: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: { type: 'object', additionalProperties: true },
      message: { type: 'string' },
    },
  },
  400: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      code: { type: 'string' },
      errors: { type: 'array' },
    },
  },
};

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  // POST /auth/signup — user signup
  app.post(
    '/auth/signup',
    {
      preHandler: [ValidateSchema(signupSchema, 'body')],
      // Only used to generate Swagger docs — actual validation/error
      // formatting is still owned by ValidateSchema above.
      attachValidation: true,
      schema: {
        tags: ['Auth'],
        summary: 'Sign up a new user',
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string', maxLength: 255 },
            lastName: { type: 'string', maxLength: 255 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8, maxLength: 255 },
          },
          required: ['firstName', 'lastName', 'email', 'password'],
        },
        response: {
          ...authResponseSchema,
          201: authResponseSchema[200],
        },
      },
    },
    signupHandler,
  );

  // POST /auth/login — user login
  app.post(
    '/auth/login',
    {
      preHandler: [ValidateSchema(loginSchema, 'body')],
      // Only used to generate Swagger docs — actual validation/error
      // formatting is still owned by ValidateSchema above.
      attachValidation: true,
      schema: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8, maxLength: 255 },
          },
          required: ['email', 'password'],
        },
        response: authResponseSchema,
      },
    },
    loginHandler,
  );

  // POST /auth/verify-email — confirm an OTP sent to the user's email
  app.post(
    '/auth/verify-email',
    {
      preHandler: [ValidateSchema(verifyEmailSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Auth'],
        summary: 'Verify a user email with an OTP',
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            otp: { type: 'string', minLength: 6, maxLength: 6 },
          },
          required: ['email', 'otp'],
        },
        response: authResponseSchema,
      },
    },
    verifyEmailHandler,
  );

  // POST /auth/forgot-password — email a password reset OTP
  app.post(
    '/auth/forgot-password',
    {
      preHandler: [ValidateSchema(forgotPasswordSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Auth'],
        summary: 'Request a password reset OTP by email',
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
        response: authResponseSchema,
      },
    },
    forgotPasswordHandler,
  );

  // POST /auth/reset-password — set a new password using a valid OTP
  app.post(
    '/auth/reset-password',
    {
      preHandler: [ValidateSchema(resetPasswordSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Auth'],
        summary: 'Reset a password using an OTP',
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            otp: { type: 'string', minLength: 6, maxLength: 6 },
            newPassword: { type: 'string', minLength: 8, maxLength: 255 },
          },
          required: ['email', 'otp', 'newPassword'],
        },
        response: authResponseSchema,
      },
    },
    resetPasswordHandler,
  );
}