-- CreateEnum
CREATE TYPE "RefundState" AS ENUM ('INITIATED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "refundReference" TEXT NOT NULL,
    "monnifyRefundReference" TEXT,
    "amount" INTEGER NOT NULL,
    "destinationAccountNumber" TEXT NOT NULL,
    "destinationBankCode" TEXT NOT NULL,
    "state" "RefundState" NOT NULL DEFAULT 'INITIATED',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refunds_transactionId_key" ON "refunds"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_refundReference_key" ON "refunds"("refundReference");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
