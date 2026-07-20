import crypto from 'crypto';
import { RefundState, TransactionState } from "@prisma/client";
import { AppError } from "../../helpers/error";
import prisma from "../../lib/prisma";
import { initiateRefund, initTransaction } from "../third-party-services/monnify";

const memberUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
} as const;

const transactionInclude = {
    membership: { include: { user: { select: memberUserSelect } } },
} as const;

// CLOSED only means "full — no new joins"; existing members can still pay
// their share right up to the deadline.
const payablePoolStatuses = ['OPEN', 'ALMOSTFUL', 'CLOSED'] as const;

const paidTransactionStates: TransactionState[] = ['PAID', 'OVERPAID'];

export interface MonnifyCollectionEventData {
    transactionReference: string;
    paymentReference: string;
    paidOn?: string;
    amountPaid: number; // kobo
    payer?: {
        name?: string;
        email?: string;
        accountNumber?: string;
        accountBankCode?: string;
    };
}

export const initiatePoolPaymentService = async (userId: string, poolId: string, amount: number) => {
    try {
        const pool = await prisma.pool.findUnique({ where: { id: poolId } });
        if (!pool) {
            throw new AppError(404, 'NOT_FOUND', `Pool with id '${poolId}' not found`);
        }

        // Checked before the status gate so a pool that's already past its
        // deadline (including EXPIRED, which only happens after the deadline
        // job runs) always reports the real reason, not a generic one.
        if (pool.deadlineAt.getTime() <= Date.now()) {
            throw new AppError(400, 'POOL_EXPIRED', `Pool deadline has passed`);
        }

        if (!payablePoolStatuses.includes(pool.status as typeof payablePoolStatuses[number])) {
            throw new AppError(400, 'POOL_NOT_OPEN', `Pool is not accepting payments`);
        }

        const membership = await prisma.membership.findUnique({
            where: { poolId_userId: { poolId, userId } },
            include: { user: true },
        });
        if (!membership) {
            throw new AppError(403, 'NOT_A_MEMBER', `You must join this pool before paying`);
        }

        const alreadyPaid = await prisma.transaction.findFirst({
            where: { membershipId: membership.id, state: { in: paidTransactionStates } },
        });
        if (alreadyPaid) {
            throw new AppError(409, 'ALREADY_PAID', `You have already paid your share for this pool`);
        }

        const nonce = crypto.randomBytes(6).toString('hex');
        const paymentReference = `CB-${poolId}-${userId}-${nonce}`;

        const initResponse = await initTransaction({
            amount,
            paymentReference,
            customerName: `${membership.user.firstName} ${membership.user.lastName}`,
            customerEmail: membership.user.email,
            paymentDescription: `Co-Buy pool: ${pool.name}`,
            paymentMethods: ['ACCOUNT_TRANSFER']
        });

        const transaction = await prisma.transaction.create({
            data: {
                poolId,
                membershipId: membership.id,
                paymentReference: initResponse.paymentReference,
                monnifyTransactionReference: initResponse.transactionReference,
                amountExpected: amount,
                state: 'PENDING',
            },
            include: transactionInclude,
        });

        if (!transaction) {
            throw new AppError(500, 'SERVER_ERROR', 'An Error occured while creating a payment transaction');
        }

        const reponse = {
            transaction,
            merchantName: initResponse.merchantName,
            checkoutUrl: initResponse.checkoutUrl
        };

        return reponse
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const listPoolTransactionsService = async (poolId: string) => {
    try {
        const pool = await prisma.pool.findUnique({ where: { id: poolId } });
        if (!pool) {
            throw new AppError(404, 'NOT_FOUND', `Pool with id '${poolId}' not found`);
        }

        return await prisma.transaction.findMany({
            where: { poolId },
            include: transactionInclude,
            orderBy: { createdAt: 'desc' },
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

/**
 * Processes a Monnify SUCCESSFUL_TRANSACTION webhook: marks the matching
 * local Transaction paid (or over/under-paid), flips the member's
 * Membership to PAID, and adds the amount to the pool's running total.
 *
 * Idempotent: a webhook already applied to a terminal-paid transaction with
 * the same transactionReference is a no-op, so Monnify's at-least-once
 * delivery retries can't double-count a contribution.
 */
export const processMonnifyCollectionWebhookService = async (eventData: MonnifyCollectionEventData): Promise<void> => {
    const transaction = await prisma.transaction.findUnique({ where: { paymentReference: eventData.paymentReference } });
    if (!transaction) {
        return;
    }

    if (
        paidTransactionStates.includes(transaction.state) &&
        transaction.monnifyTransactionReference === eventData.transactionReference
    ) {
        return;
    }

    const amountPaid = eventData.amountPaid;
    const state: TransactionState =
        amountPaid === transaction.amountExpected ? 'PAID' : amountPaid > transaction.amountExpected ? 'OVERPAID' : 'UNDERPAID';

    await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
            where: { id: transaction.id },
            data: {
                state,
                amountPaid,
                paidAt: eventData.paidOn ? new Date(eventData.paidOn) : new Date(),
                monnifyTransactionReference: eventData.transactionReference,
                sourceAccountNumber: eventData.payer?.accountNumber ?? null,
                sourceBankCode: eventData.payer?.accountBankCode ?? null,
                sourceAccountName: eventData.payer?.name ?? null,
            },
        });

        await tx.membership.update({
            where: { id: transaction.membershipId },
            data: { state: 'PAID' },
        });

        await tx.pool.update({
            where: { id: transaction.poolId },
            data: { amountRaised: { increment: amountPaid } },
        });
    });
}

// Best-effort: mark a still-pending transaction FAILED when Monnify reports
// a non-success event for it. A no-op if the transaction is already terminal
// or unknown, so it's safe to call from any webhook branch we don't recognize.
export const markTransactionFailedService = async (paymentReference: string): Promise<void> => {
    const transaction = await prisma.transaction.findUnique({ where: { paymentReference } });
    if (!transaction || transaction.state !== 'PENDING') {
        return;
    }

    await prisma.transaction.update({ where: { id: transaction.id }, data: { state: 'FAILED' } });
}

/**
 * Fans out refunds for every paid contribution on a pool that failed to
 * fund by its deadline — one refund per Transaction (not per member), since
 * Monnify's refund API refunds a specific transactionReference back to the
 * account it came from. Called by the deadline job once a pool moves to
 * REFUNDING; safe to call again (e.g. a retried job tick) since transactions
 * that already have a Refund row are skipped.
 */
export const initiateRefundsForPoolService = async (poolId: string): Promise<void> => {
    const transactions = await prisma.transaction.findMany({
        where: { poolId, state: { in: paidTransactionStates } },
        include: { refund: true },
    });

    for (const transaction of transactions) {
        if (transaction.refund) {
            continue;
        }

        if (!transaction.monnifyTransactionReference || !transaction.sourceAccountNumber || !transaction.sourceBankCode) {
            // No source account captured (e.g. webhook never landed cleanly) —
            // can't safely refund; needs manual attention/reconciliation.
            console.error(`Skipping refund for transaction ${transaction.id}: missing source account details`);
            continue;
        }

        const refundAmount = transaction.amountPaid ?? transaction.amountExpected;
        const nonce = crypto.randomBytes(6).toString('hex');
        const refundReference = `CB-RF-${transaction.id}-${nonce}`;

        try {
            const refundResponse = await initiateRefund({
                refundReference,
                transactionReference: transaction.monnifyTransactionReference,
                amount: refundAmount,
                refundReason: 'Pool did not reach its funding target before the deadline',
            });

            await prisma.$transaction(async (tx) => {
                await tx.refund.create({
                    data: {
                        transactionId: transaction.id,
                        poolId: transaction.poolId,
                        membershipId: transaction.membershipId,
                        refundReference,
                        monnifyRefundReference: refundResponse.refundReference ?? null,
                        amount: refundAmount,
                        destinationAccountNumber: transaction.sourceAccountNumber as string,
                        destinationBankCode: transaction.sourceBankCode as string,
                        state: 'INITIATED',
                    },
                });

                await tx.membership.update({
                    where: { id: transaction.membershipId },
                    data: { state: 'REFUND_PENDING' },
                });
            });
        } catch (error: any) {
            // One failed refund call shouldn't stop the rest of the pool's
            // members from being refunded — log and move on.
            console.error(`Failed to initiate refund for transaction ${transaction.id}:`, error.message);
        }
    }
}

export interface MonnifyRefundEventData {
    refundReference: string;
    transactionReference?: string;
    status: 'COMPLETED' | 'FAILED';
    amount?: number;
}

/**
 * Processes a Monnify SUCCESSFUL_REFUND/FAILED_REFUND webhook: marks the
 * matching Refund COMPLETED/FAILED, then cascades — once every refund on a
 * membership is COMPLETED, that Membership flips to REFUNDED; once every
 * refund issued for the pool is COMPLETED, the Pool itself flips to
 * REFUNDED (members who never paid never had a refund, so they don't block this).
 */
export const processMonnifyRefundWebhookService = async (eventData: MonnifyRefundEventData): Promise<void> => {
    const refund = await prisma.refund.findUnique({ where: { refundReference: eventData.refundReference } });
    if (!refund) {
        return;
    }

    if (refund.state !== 'INITIATED') {
        // Already finalized — webhook retry, no-op.
        return;
    }

    const state: RefundState = eventData.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';

    await prisma.refund.update({
        where: { id: refund.id },
        data: {
            state,
            monnifyRefundReference: eventData.transactionReference ?? refund.monnifyRefundReference,
            finalizedAt: new Date(),
        },
    });

    if (state === 'FAILED') {
        // Needs manual attention — leave the membership in REFUND_PENDING.
        return;
    }

    // Flip this membership once all of its own refunds are COMPLETED.
    const outstandingOnMembership = await prisma.refund.count({
        where: { membershipId: refund.membershipId, state: { not: 'COMPLETED' } },
    });
    if (outstandingOnMembership === 0) {
        await prisma.membership.update({ where: { id: refund.membershipId }, data: { state: 'REFUNDED' } });
    }

    // Flip the pool once every refund issued for it is COMPLETED — members who
    // never paid (and so never had a refund) don't block this.
    const outstandingOnPool = await prisma.refund.count({
        where: { poolId: refund.poolId, state: { not: 'COMPLETED' } },
    });
    if (outstandingOnPool === 0) {
        await prisma.pool.update({ where: { id: refund.poolId }, data: { status: 'REFUNDED', stateChangedAt: new Date() } });
    }
}
