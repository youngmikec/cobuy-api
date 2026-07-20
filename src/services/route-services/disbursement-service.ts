import crypto from 'crypto';
import { DisbursementState } from "@prisma/client";
import prisma from "../../lib/prisma";
import { initiateSingleTransfer, resolveBankAccount } from "../third-party-services/monnify";

const PLATFORM_FEE_PERCENT = parseFloat(process.env['PLATFORM_FEE_PERCENT'] ?? '2');

export interface MonnifyDisbursementEventData {
    reference: string;
    status: 'SUCCESS' | 'FAILED' | 'REVERSED';
    transactionRef?: string;
}

/**
 * Pays out a fully-funded pool to its beneficiary, minus the platform fee
 * (PLATFORM_FEE_PERCENT env, default 2%). Idempotent — a pool only ever gets
 * one Disbursement row (unique on poolId), so this is safe to call again
 * (e.g. a retried deadline-job tick or a retry after a failed Monnify call
 * left the pool in DISBURSING).
 */
export const disburseToBeneficiaryService = async (poolId: string): Promise<void> => {
    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool || (pool.status !== 'FUNDED' && pool.status !== 'DISBURSING')) {
        return;
    }

    const existing = await prisma.disbursement.findUnique({ where: { poolId } });
    if (existing) {
        return;
    }

    if (!pool.beneficiaryAccountNumber || !pool.beneficiaryBankCode) {
        console.error(`Cannot disburse pool ${poolId}: missing beneficiary account number/bank code`);
        return;
    }

    // Name Enquiry pre-flight if we don't already have a verified account
    // name — required before every transfer (skill doc section 3).
    let beneficiaryAccountName = pool.beneficiaryAccountName ?? undefined;
    if (!beneficiaryAccountName) {
        try {
            const nameEnquiry = await resolveBankAccount(pool.beneficiaryAccountNumber, pool.beneficiaryBankCode);
            beneficiaryAccountName = nameEnquiry.responseBody.accountName;
            await prisma.pool.update({ where: { id: poolId }, data: { beneficiaryAccountName } });
        } catch (error: any) {
            console.error(`Name Enquiry failed for pool ${poolId} beneficiary — leaving for retry:`, error.message);
            return;
        }
    }

    if (pool.status !== 'DISBURSING') {
        await prisma.pool.update({ where: { id: poolId }, data: { status: 'DISBURSING', stateChangedAt: new Date() } });
    }

    const grossAmount = pool.amountRaised;
    const feeAmount = Math.round(grossAmount * (PLATFORM_FEE_PERCENT / 100));
    const netAmount = grossAmount - feeAmount;

    const nonce = crypto.randomBytes(6).toString('hex');
    const disbursementReference = `CB-PAY-${poolId}-${nonce}`;

    try {
        const transferResponse = await initiateSingleTransfer({
            reference: disbursementReference,
            amount: netAmount,
            destinationAccountNumber: pool.beneficiaryAccountNumber,
            destinationBankCode: pool.beneficiaryBankCode,
            destinationAccountName: beneficiaryAccountName,
            narration: `Co-Buy pool payout: ${pool.name}`.slice(0, 100),
        });

        await prisma.disbursement.create({
            data: {
                poolId,
                disbursementReference,
                monnifyReference: transferResponse.reference ?? null,
                grossAmount,
                feeAmount,
                netAmount,
                destinationAccountNumber: pool.beneficiaryAccountNumber,
                destinationBankCode: pool.beneficiaryBankCode,
                destinationAccountName: beneficiaryAccountName ?? null,
                state: 'INITIATED',
            },
        });
    } catch (error: any) {
        // Pool stays in DISBURSING — no Disbursement row was created, so the
        // next call to this function (job retry) will attempt it again.
        console.error(`Failed to initiate disbursement for pool ${poolId}:`, error.message);
    }
}

/**
 * Processes a Monnify SUCCESSFUL_DISBURSEMENT/FAILED_DISBURSEMENT webhook:
 * marks the matching Disbursement SUCCESS/FAILED/REVERSED, and on SUCCESS
 * flips the pool to COMPLETED. FAILED/REVERSED leaves the pool in
 * DISBURSING — needs manual attention, matching the refund FAILED pattern.
 */
export const processMonnifyDisbursementWebhookService = async (eventData: MonnifyDisbursementEventData): Promise<void> => {
    const disbursement = await prisma.disbursement.findUnique({ where: { disbursementReference: eventData.reference } });
    if (!disbursement || disbursement.state !== 'INITIATED') {
        return;
    }

    const state: DisbursementState =
        eventData.status === 'SUCCESS' ? 'SUCCESS' : eventData.status === 'REVERSED' ? 'REVERSED' : 'FAILED';

    await prisma.disbursement.update({
        where: { id: disbursement.id },
        data: {
            state,
            monnifyReference: eventData.transactionRef ?? disbursement.monnifyReference,
            finalizedAt: new Date(),
        },
    });

    if (state === 'SUCCESS') {
        await prisma.pool.update({ where: { id: disbursement.poolId }, data: { status: 'COMPLETED', stateChangedAt: new Date() } });
    }
}
