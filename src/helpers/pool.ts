import { Category, Pool } from '@prisma/client';

type PoolWithMemberCount = Pool & { 
  _count: { memberships: number }; 
  category: Category
  leader: { id: string; firstName: string; lastName: string; email: string }
};

export const toPoolDto = (pool: PoolWithMemberCount) => {
  const { _count, ...rest } = pool;

  return {
    ...rest,
    leader: {
      id: pool.leader.id,
      firstName: pool.leader.firstName,
      lastName: pool.leader.lastName,
      email: pool.leader.email
    },
    targetAmount: pool.targetAmount,
    amountRaised: pool.amountRaised,
    amountPerSlot: pool.memberShareAmount,
    slotsRemaining: pool.slotRemaining
  };
};
