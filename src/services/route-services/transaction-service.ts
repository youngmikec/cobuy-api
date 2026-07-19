import crypto from 'crypto';
import { TransactionState } from "@prisma/client";
import { AppError } from "../../helpers/error";
import prisma from "../../lib/prisma";
import { initTransaction } from "../third-party-services/monnify";

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

const payablePoolStatuses = ['OPEN', 'ALMOSTFUL'] as const;

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

        if (!payablePoolStatuses.includes(pool.status as typeof payablePoolStatuses[number])) {
            throw new AppError(400, 'POOL_NOT_OPEN', `Pool is not accepting payments`);
        }

        if (pool.deadlineAt.getTime() <= Date.now()) {
            throw new AppError(400, 'POOL_EXPIRED', `Pool deadline has passed`);
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
