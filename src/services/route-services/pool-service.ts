import { PoolStatus, Prisma } from "@prisma/client";
import { AppError } from "../../helpers/error";
import { toPoolDto } from "../../helpers/pool";
import prisma from "../../lib/prisma";
import { CreatePoolInput, ListPoolsQuery } from "../../schemas/pool.schema";
import { createNotificationService, notifyPoolMembersService } from "./notification-service";
import { emitPoolUpdate } from "../../lib/socket";

const APP_BASE_URL = process.env['APP_BASE_URL'] ?? 'https://cobuy.app';

const poolInclude = { 
    _count: { select: { memberships: true } }, 
    category: true,
    leader: { select: { id: true, firstName: true, lastName: true, email: true }} 
} as const;

const DEFAULT_CATEGORY_NAME = 'Custom';

// Resolves the categoryId a pool should be created with: the given id (must
// exist and be active) or, when omitted, the seeded 'Custom' category —
// mirroring the old PoolCategory enum's @default(Custom) behavior.
const resolveCategoryId = async (categoryId: string | undefined): Promise<string> => {
    if (!categoryId) {
        const defaultCategory = await prisma.category.findUnique({ where: { name: DEFAULT_CATEGORY_NAME } });
        if (!defaultCategory) {
            throw new AppError(500, 'SERVER_ERROR', `Default category '${DEFAULT_CATEGORY_NAME}' is not seeded`);
        }
        return defaultCategory.id;
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
        throw new AppError(404, 'NOT_FOUND', `Category with id '${categoryId}' not found`);
    }
    if (!category.isActive) {
        throw new AppError(400, 'CATEGORY_INACTIVE', `Category '${category.name}' is not active`);
    }

    return category.id;
};

const memberUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
} as const;

const joinablePoolStatuses = ['OPEN', 'ALMOSTFUL'] as const;

export const createPoolService = async (leaderId: string, payload: CreatePoolInput) => {
    try {
        const {
            name,
            description,
            categoryId,
            targetAmount,
            maxMembers,
            splitEven,
            memberShareAmount,
            beneficiaryAccountNumber,
            beneficiaryAccountName,
            beneficiaryBankName,
            beneficiaryBankCode,
            beneficiaryUserId,
            deadlineAt,
        } = payload;

        if (beneficiaryUserId) {
            const beneficiary = await prisma.user.findUnique({ where: { id: beneficiaryUserId } });
            if (!beneficiary) {
                throw new AppError(404, 'NOT_FOUND', `Beneficiary user '${beneficiaryUserId}' not found`);
            }
        }

        const resolvedCategoryId = await resolveCategoryId(categoryId);

        const resolvedShareAmount = splitEven
            ? Math.floor(targetAmount / maxMembers)
            : (memberShareAmount as number > 0) ? (memberShareAmount as number) : 0;

        console.log({ slotRemaining: maxMembers - 1, resolvedShareAmount });

        const {pool} = await prisma.$transaction(async (tx) => {
            const pool = await tx.pool.create({
                data: {
                    leaderId,
                    name,
                    description: description ?? null,
                    categoryId: resolvedCategoryId,
                    targetAmount,
                    maxMembers,
                    splitEven,
                    slotRemaining: (maxMembers - 1),
                    memberShareAmount: resolvedShareAmount,
                    beneficiaryAccountNumber,
                    beneficiaryBankName,
                    beneficiaryBankCode,
                    beneficiaryAccountName,
                    beneficiaryUserId: beneficiaryUserId ?? null,
                    deadlineAt,
                    createdById: leaderId,
                },
                include: poolInclude,
            });

            const membership = await tx.membership.create({
                data: {
                    poolId: pool.id,
                    userId: leaderId,
                    state: 'JOINED',
                    joinedAt: new Date(),
                },
                include: { user: { select: memberUserSelect } },
            });

            return {pool, membership};
        });

        // Best-effort, outside the transaction — a notification failure
        // shouldn't undo a pool that was already successfully created.
        try {
            await createNotificationService({
                userId: leaderId,
                type: 'POOL_CREATED',
                title: 'Pool created',
                message: `Your pool "${pool.name}" has been created successfully.`,
                poolId: pool.id,
            });
        } catch (error: any) {
            console.error(`Failed to create POOL_CREATED notification for user ${leaderId}:`, error.message);
        }

        return {
            ...toPoolDto(pool),
            shareLink: `${APP_BASE_URL}/join/${pool.shareToken}`,
        };
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const listPoolsService = async (filters: ListPoolsQuery = {}) => {
    try {
        const { status, search } = filters;

        const where: Prisma.PoolWhereInput = {
            ...(status ? { status: status as PoolStatus } : {}),
            ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        };

        const pools = await prisma.pool.findMany({
            where,
            include: poolInclude,
            orderBy: { createdAt: 'desc' },
        });

        return pools.map((pool) => ({
            ...toPoolDto(pool),
            shareLink: `${APP_BASE_URL}/join/${pool.shareToken}`,
        }));
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const getPoolByIdService = async (id: string) => {
    try {
        const pool = await prisma.pool.findUnique({ where: { id }, include: poolInclude });
        if (!pool) {
            throw new AppError(404, 'NOT_FOUND', `Pool with id '${id}' not found`);
        }

        return {
            ...toPoolDto(pool),
            shareLink: `${APP_BASE_URL}/join/${pool.shareToken}`,
        };
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const listMyPoolsService = async (userId: string) => {
    try {
        const pools = await prisma.pool.findMany({
            where: { memberships: { some: { userId } } },
            include: poolInclude,
            orderBy: { createdAt: 'desc' },
        });

        return pools.map((pool) => ({
            ...toPoolDto(pool),
            shareLink: `${APP_BASE_URL}/join/${pool.shareToken}`,
        }));
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const joinPoolService = async (userId: string, poolId: string) => {
    try {
        const pool = await prisma.pool.findUnique({ where: { id: poolId }, include: poolInclude });
        if (!pool) {
            throw new AppError(404, 'NOT_FOUND', `Pool with id '${poolId}' not found`);
        }

        if (!joinablePoolStatuses.includes(pool.status as typeof joinablePoolStatuses[number])) {
            throw new AppError(400, 'POOL_NOT_OPEN', `Pool is not open for new members`);
        }

        if (pool.deadlineAt.getTime() <= Date.now()) {
            throw new AppError(400, 'POOL_EXPIRED', `Pool deadline has passed`);
        }

        const slotsRemaining = Math.max(pool.maxMembers - pool._count.memberships, 0);
        if (slotsRemaining <= 0) {
            throw new AppError(400, 'POOL_FULL', `Pool has no slots remaining`);
        }

        const existingMembership = await prisma.membership.findUnique({
            where: { poolId_userId: { poolId, userId } },
        });

        if (existingMembership) {
            throw new AppError(409, 'ALREADY_JOINED', `You have already joined this pool`);
        }

        // Computed ahead of the update so the same write can flip status to
        // CLOSED the instant the last slot is taken — no deadline job needed
        // to stop further joins.
        const remainingAfterJoin = Math.max(pool.slotRemaining - 1, 0);

        const [membership, updatedPool] = await prisma.$transaction([
            prisma.membership.create({
                data: {
                    poolId,
                    userId,
                    state: 'JOINED',
                    joinedAt: new Date(),
                },
                include: { user: { select: memberUserSelect } },
            }),
            prisma.pool.update({
                where: { id: poolId },
                data: {
                    slotRemaining: remainingAfterJoin,
                    ...(remainingAfterJoin === 0 ? { status: 'CLOSED' } : {}),
                    updatedAt: new Date(),
                },
            }),
        ])  ;

        emitPoolUpdate(updatedPool);

        if (remainingAfterJoin === 0) {
            try {
                await notifyPoolMembersService({
                    poolId,
                    type: 'POOL_STATUS_CHANGED',
                    title: 'Pool is now closed',
                    message: `"${pool.name}" has filled all its slots and is now closed to new members.`,
                });
            } catch (error: any) {
                console.error(`Failed to fan out POOL_STATUS_CHANGED notifications for pool ${poolId}:`, error.message);
            }
        }

        return membership;
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const listPoolMembersService = async (poolId: string) => {
    try {
        const pool = await prisma.pool.findUnique({ where: { id: poolId } });
        if (!pool) {
            throw new AppError(404, 'NOT_FOUND', `Pool with id '${poolId}' not found`);
        }

        const members = await prisma.membership.findMany({
            where: { poolId },
            include: { user: { select: memberUserSelect } },
            orderBy: { joinedAt: 'asc' },
        });

        return members;
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

// Lets the pool leader hand-pick existing app users to add directly,
// instead of waiting for them to join via the share link. Already-members
// are silently skipped (reported back in skippedUserIds) rather than
// failing the whole batch.
export const addPoolMembersService = async (leaderId: string, poolId: string, userIds: string[]) => {
    try {
        const pool = await prisma.pool.findUnique({ where: { id: poolId }, include: poolInclude });
        if (!pool) {
            throw new AppError(404, 'NOT_FOUND', `Pool with id '${poolId}' not found`);
        }

        if (pool.leaderId !== leaderId) {
            throw new AppError(403, 'FORBIDDEN', `Only the pool leader can add members`);
        }

        if (!joinablePoolStatuses.includes(pool.status as typeof joinablePoolStatuses[number])) {
            throw new AppError(400, 'POOL_NOT_OPEN', `Pool is not open for new members`);
        }

        if (pool.deadlineAt.getTime() <= Date.now()) {
            throw new AppError(400, 'POOL_EXPIRED', `Pool deadline has passed`);
        }

        const uniqueUserIds = Array.from(new Set(userIds));

        const users = await prisma.user.findMany({ where: { id: { in: uniqueUserIds } } });
        const foundIds = new Set(users.map((user) => user.id));
        const missingIds = uniqueUserIds.filter((id) => !foundIds.has(id));
        if (missingIds.length > 0) {
            throw new AppError(404, 'NOT_FOUND', `User(s) not found: ${missingIds.join(', ')}`);
        }

        const existingMemberships = await prisma.membership.findMany({
            where: { poolId, userId: { in: uniqueUserIds } },
            select: { userId: true },
        });
        const alreadyMemberIds = new Set(existingMemberships.map((membership) => membership.userId));
        const newUserIds = uniqueUserIds.filter((id) => !alreadyMemberIds.has(id));

        if (newUserIds.length === 0) {
            throw new AppError(409, 'ALREADY_JOINED', `All selected users are already members of this pool`);
        }

        const slotsRemaining = Math.max(pool.maxMembers - pool._count.memberships, 0);
        if (newUserIds.length > slotsRemaining) {
            throw new AppError(
                400,
                'POOL_FULL',
                `Pool only has ${slotsRemaining} slot(s) remaining, but ${newUserIds.length} new member(s) were selected`,
            );
        }

        // Computed ahead of the update so the same write can flip status to
        // CLOSED the instant the last slot is taken — same as joinPoolService.
        const remainingAfterAdd = Math.max(pool.slotRemaining - newUserIds.length, 0);

        const { memberships, updatedPool } = await prisma.$transaction(async (tx) => {
            const created = await Promise.all(
                newUserIds.map((userId) =>
                    tx.membership.create({
                        data: { poolId, userId, state: 'JOINED', joinedAt: new Date() },
                        include: { user: { select: memberUserSelect } },
                    }),
                ),
            );

            const updated = await tx.pool.update({
                where: { id: poolId },
                data: {
                    slotRemaining: remainingAfterAdd,
                    ...(remainingAfterAdd === 0 ? { status: 'CLOSED' } : {}),
                    updatedAt: new Date(),
                },
            });

            return { memberships: created, updatedPool: updated };
        });

        emitPoolUpdate(updatedPool);

        // Best-effort, outside the transaction — a notification failure
        // shouldn't undo memberships that were already successfully created.
        await Promise.all(
            memberships.map(async (membership) => {
                try {
                    await createNotificationService({
                        userId: membership.userId,
                        type: 'ADDED_TO_POOL',
                        title: 'You were added to a pool',
                        message: `${pool.leader.firstName} ${pool.leader.lastName} added you to "${pool.name}".`,
                        poolId: pool.id,
                    });
                } catch (error: any) {
                    console.error(`Failed to create ADDED_TO_POOL notification for user ${membership.userId}:`, error.message);
                }
            }),
        );

        if (remainingAfterAdd === 0) {
            try {
                await notifyPoolMembersService({
                    poolId,
                    type: 'POOL_STATUS_CHANGED',
                    title: 'Pool is now closed',
                    message: `"${pool.name}" has filled all its slots and is now closed to new members.`,
                });
            } catch (error: any) {
                console.error(`Failed to fan out POOL_STATUS_CHANGED notifications for pool ${poolId}:`, error.message);
            }
        }

        return {
            addedCount: memberships.length,
            skippedUserIds: Array.from(alreadyMemberIds),
            memberships,
        };
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}
