import prisma from "../lib/prisma";
import { initiateRefundsForPoolService } from "../services/route-services/transaction-service";
import { disburseToBeneficiaryService } from "../services/route-services/disbursement-service";
import { notifyPoolMembersService } from "../services/route-services/notification-service";

// Matches the "every 2 min" cadence called out in
// .claude/skills/monnify/monnify-cobuy-skill.md for the deadline scheduler.
const DEADLINE_CHECK_INTERVAL_MS = parseInt(process.env['POOL_DEADLINE_CHECK_INTERVAL_MS'] ?? '120000', 10);

// Pools land here once past deadlineAt while still accepting members/payments —
// each is processed exactly once since every branch below moves it out of this set.
const duePoolStatuses = ['OPEN', 'ALMOSTFUL', 'CLOSED'] as const;

// Best-effort — a notification failure shouldn't stop the job from moving
// the pool through its deadline-driven status transitions.
const notifyStatusChange = async (poolId: string, title: string, message: string): Promise<void> => {
    try {
        await notifyPoolMembersService({ poolId, type: 'POOL_STATUS_CHANGED', title, message });
    } catch (error: any) {
        console.error(`Failed to fan out POOL_STATUS_CHANGED notifications for pool ${poolId}:`, error.message);
    }
}

export const processExpiredPools = async (): Promise<void> => {
    const now = new Date();

    const duePools = await prisma.pool.findMany({
        where: {
            deadlineAt: { lte: now },
            status: { in: [...duePoolStatuses] },
        },
    });

    for (const pool of duePools) {
        try {
            if (pool.amountRaised >= pool.targetAmount) {
                // Normally already triggered the moment the target was hit
                // (see processMonnifyCollectionWebhookService) — this is a
                // safety net for a lost/delayed webhook. disburseToBeneficiaryService
                // is idempotent (one Disbursement row per pool), so this is safe.
                await prisma.pool.update({
                    where: { id: pool.id },
                    data: { status: 'FUNDED', stateChangedAt: new Date() },
                });
                await notifyStatusChange(pool.id, 'Pool fully funded', `"${pool.name}" has reached its funding target and will now be disbursed.`);
                await disburseToBeneficiaryService(pool.id);
                continue;
            }

            await prisma.pool.update({
                where: { id: pool.id },
                data: { status: 'EXPIRED', stateChangedAt: new Date() },
            });
            await notifyStatusChange(pool.id, 'Pool expired', `"${pool.name}" did not reach its funding target before the deadline and has expired.`);

            await prisma.pool.update({
                where: { id: pool.id },
                data: { status: 'REFUNDING', stateChangedAt: new Date() },
            });
            await notifyStatusChange(pool.id, 'Pool refund in progress', `Refunds are now being processed for "${pool.name}".`);

            await initiateRefundsForPoolService(pool.id);
        } catch (error: any) {
            // One pool failing shouldn't stop the rest of the batch from processing.
            console.error(`Failed to process deadline for pool ${pool.id}:`, error.message);
        }
    }
}

let intervalHandle: NodeJS.Timeout | undefined;

export const startPoolDeadlineJob = (): void => {
    if (intervalHandle) {
        return;
    }

    intervalHandle = setInterval(() => {
        processExpiredPools().catch((error) => console.error('Pool deadline job tick failed:', error));
    }, DEADLINE_CHECK_INTERVAL_MS);

    // Run once immediately so pools that expired while the server was down
    // aren't left waiting a full interval.
    processExpiredPools().catch((error) => console.error('Pool deadline job initial run failed:', error));
}

export const stopPoolDeadlineJob = (): void => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = undefined;
    }
}
