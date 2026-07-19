import { FastifyReply, FastifyRequest } from "fastify";
import { isMonnifyProduction, verifyMonnifyWebhookSignature } from "../helpers/monnify";
import {
    markTransactionFailedService,
    processMonnifyCollectionWebhookService,
    processMonnifyRefundWebhookService,
    type MonnifyCollectionEventData,
} from "../services/route-services/transaction-service";

interface MonnifyWebhookBody {
    eventType?: string;
    eventData?: Partial<MonnifyCollectionEventData> & {
        paymentReference?: string;
        refundReference?: string;
    };
}

// Monnify expects a fast 200 and retries on anything else, so signature
// failures and processing errors are logged, never surfaced as non-2xx —
// see .claude/skills/monnify/monnify-cobuy-skill.md section 7.
export const monnifyWebhookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    // Sandbox webhooks don't carry a monnify-signature header at all (per
    // Monnify's docs), so there's nothing to verify until MONNIFY_ENV=production.
    if (isMonnifyProduction()) {
        const signature = request.headers['monnify-signature'] as string | undefined;
        const rawBody = request.rawBody;

        if (!rawBody || !verifyMonnifyWebhookSignature(rawBody.toString('utf8'), signature)) {
            request.log.warn('Monnify webhook signature verification failed');
            return reply.status(200).send({ received: true });
        }
    }

    const body = request.body as MonnifyWebhookBody;

    try {
        if (body.eventType === 'SUCCESSFUL_TRANSACTION' && body.eventData) {
            await processMonnifyCollectionWebhookService(body.eventData as MonnifyCollectionEventData);
        } else if ((body.eventType === 'SUCCESSFUL_REFUND' || body.eventType === 'FAILED_REFUND') && body.eventData?.refundReference) {
            const eventAmount = (body.eventData as { amount?: number }).amount;
            await processMonnifyRefundWebhookService({
                refundReference: body.eventData.refundReference,
                status: body.eventType === 'SUCCESSFUL_REFUND' ? 'COMPLETED' : 'FAILED',
                ...(body.eventData.transactionReference ? { transactionReference: body.eventData.transactionReference } : {}),
                ...(eventAmount !== undefined ? { amount: eventAmount } : {}),
            });
        } else if (body.eventData?.paymentReference) {
            await markTransactionFailedService(body.eventData.paymentReference);
        } else {
            request.log.info({ eventType: body.eventType }, 'Unhandled Monnify webhook event type');
        }
    } catch (error) {
        request.log.error({ error }, 'Failed to process Monnify webhook');
    }

    return reply.status(200).send({ received: true });
}
