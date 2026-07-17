-- CreateEnum
CREATE TYPE "PoolCategory" AS ENUM ('BulkPurchase', 'Ajo', 'Fundraising', 'Repair', 'Investment', 'GroupGift', 'Education', 'Custom');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'ALMOSTFUL', 'CLOSED', 'FUNDED', 'DISBURSING', 'COMPLETED', 'EXPIRED', 'REFUNDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MembershipState" AS ENUM ('JOINED', 'AWAITING_PAYMENT', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED');

-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "PoolCategory" NOT NULL DEFAULT 'Custom',
    "targetAmountKobo" INTEGER NOT NULL,
    "amountRaisedKobo" INTEGER NOT NULL DEFAULT 0,
    "maxMembers" INTEGER NOT NULL,
    "splitEven" BOOLEAN NOT NULL DEFAULT true,
    "memberShareAmountKobo" INTEGER NOT NULL,
    "beneficiaryAccountNumber" TEXT NOT NULL,
    "beneficiaryBankName" TEXT NOT NULL,
    "beneficiaryAccountName" TEXT,
    "beneficiaryUserId" TEXT,
    "shareToken" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "MembershipState" NOT NULL DEFAULT 'JOINED',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pools_shareToken_key" ON "pools"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_poolId_userId_key" ON "memberships"("poolId", "userId");

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
