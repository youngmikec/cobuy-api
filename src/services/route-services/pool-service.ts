import { PoolStatus, Prisma } from "@prisma/client";
import { AppError } from "../../helpers/error";
import { toPoolDto } from "../../helpers/pool";
import prisma from "../../lib/prisma";
import { CreatePoolInput, ListPoolsQuery } from "../../schemas/pool.schema";

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

        const [membership] = await prisma.$transaction([
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
                    slotRemaining: pool.slotRemaining > 0 ? { decrement: 1 } : 0,
                    updatedAt: new Date() 
                },
            }),
        ])  ;

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
