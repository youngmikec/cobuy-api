-- CreateEnum
CREATE TYPE "DisbursementState" AS ENUM ('INITIATED', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "disbursements" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "disbursementReference" TEXT NOT NULL,
    "monnifyReference" TEXT,
    "grossAmount" INTEGER NOT NULL,
    "feeAmount" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "destinationAccountNumber" TEXT NOT NULL,
    "destinationBankCode" TEXT NOT NULL,
    "destinationAccountName" TEXT,
    "state" "DisbursementState" NOT NULL DEFAULT 'INITIATED',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disbursements_poolId_key" ON "disbursements"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "disbursements_disbursementReference_key" ON "disbursements"("disbursementReference");

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
