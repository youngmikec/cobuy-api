import { FastifyInstance } from 'fastify';
import { monnifyWebhookHandler } from '../controllers/index';

// Not versioned/prefixed and not JWT-guarded — Monnify calls this directly
// and authenticity is established via HMAC signature (see helpers/monnify.ts).
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhooks/monnify',
    {
      config: { rawBody: true },
      schema: {
        tags: ['Webhooks'],
        summary: 'Monnify webhook receiver (collections, disbursements, refunds)',
        response: {
          200: {
            type: 'object',
            properties: { received: { type: 'boolean' } },
          },
        },
      },
    },
    monnifyWebhookHandler,
  );
}
