import prisma from "../lib/prisma";
import { initiateRefundsForPoolService } from "../services/route-services/transaction-service";

// Matches the "every 2 min" cadence called out in
// .claude/skills/monnify/monnify-cobuy-skill.md for the deadline scheduler.
const DEADLINE_CHECK_INTERVAL_MS = parseInt(process.env['POOL_DEADLINE_CHECK_INTERVAL_MS'] ?? '120000', 10);

// Pools land here once past deadlineAt while still accepting members/payments —
// each is processed exactly once since every branch below moves it out of this set.
const duePoolStatuses = ['OPEN', 'ALMOSTFUL', 'CLOSED'] as const;

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
                // Funded in time — payout to the beneficiary is a separate,
                // not-yet-built flow (FUNDED -> DISBURSING -> COMPLETED).
                await prisma.pool.update({
                    where: { id: pool.id },
                    data: { status: 'FUNDED', stateChangedAt: new Date() },
                });
                continue;
            }

            await prisma.pool.update({
                where: { id: pool.id },
                data: { status: 'EXPIRED', stateChangedAt: new Date() },
            });
            await prisma.pool.update({
                where: { id: pool.id },
                data: { status: 'REFUNDING', stateChangedAt: new Date() },
            });

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
