import { Pool } from '@prisma/client';

type PoolWithMemberCount = Pool & { _count: { memberships: number } };

export const toPoolDto = (pool: PoolWithMemberCount) => {
  const { _count, ...rest } = pool;

  return {
    ...rest,
    slotsRemaining: pool.slotRemaining
  };
};
