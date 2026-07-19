-- CreateEnum
CREATE TYPE "TransactionState" AS ENUM ('PENDING', 'PAID', 'OVERPAID', 'UNDERPAID', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "monnifyTransactionReference" TEXT,
    "dynamicAccountNumber" TEXT,
    "dynamicAccountBankCode" TEXT,
    "dynamicAccountExpiresAt" TIMESTAMP(3),
    "amountExpected" INTEGER NOT NULL,
    "amountPaid" INTEGER,
    "sourceAccountNumber" TEXT,
    "sourceBankCode" TEXT,
    "sourceAccountName" TEXT,
    "state" "TransactionState" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_paymentReference_key" ON "transactions"("paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_monnifyTransactionReference_key" ON "transactions"("monnifyTransactionReference");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
