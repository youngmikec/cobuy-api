import { FastifyInstance } from "fastify";
import { ValidateSchema } from "../middlewares";
import {
  forgotPasswordSchema,
  loginSchema,
  resendOtpSchema,
  resetPasswordSchema,
  signupSchema,
  triggerOtpSchema,
  verifyEmailSchema,
  refreshTokenSchema,
} from "../schemas/auth.schema";
import {
  forgotPasswordHandler,
  loginHandler,
  refreshTokenHandler,
  resendOtpHandler,
  resetPasswordHandler,
  signupHandler,
  triggerOtpHandler,
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

  // POST /auth/refresh-token — refresh an access token using a refresh token
  app.post(
    '/auth/refresh-token',
    {
      preHandler: [ValidateSchema(refreshTokenSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Auth'],
        summary: 'Refresh an access token using a refresh token',
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
          required: ['refreshToken'],
        },
        response: authResponseSchema,
      },
    },
    refreshTokenHandler,
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

  // POST /auth/resend-otp — resend an expired email-verification OTP
  app.post(
    '/auth/resend-otp',
    {
      preHandler: [ValidateSchema(resendOtpSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Auth'],
        summary: 'Resend an expired email verification OTP',
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
    resendOtpHandler,
  );

  // POST /auth/trigger-otp — backup endpoint to (re)send a verification OTP
  // for a registered account that never completed email verification
  app.post(
    '/auth/trigger-otp',
    {
      preHandler: [ValidateSchema(triggerOtpSchema, 'body')],
      attachValidation: true,
      schema: {
        tags: ['Auth'],
        summary: 'Trigger a verification OTP for an unverified account',
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
    triggerOtpHandler,
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