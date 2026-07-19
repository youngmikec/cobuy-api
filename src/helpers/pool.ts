import { Category, Pool } from '@prisma/client';

type PoolWithMemberCount = Pool & { _count: { memberships: number }; category: Category };

export const toPoolDto = (pool: PoolWithMemberCount) => {
  const { _count, ...rest } = pool;

  return {
    ...rest,
    slotsRemaining: pool.slotRemaining
  };
};
