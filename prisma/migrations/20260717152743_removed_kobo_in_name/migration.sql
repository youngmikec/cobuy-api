/*
  Warnings:

  - You are about to drop the column `amountRaisedKobo` on the `pools` table. All the data in the column will be lost.
  - You are about to drop the column `memberShareAmountKobo` on the `pools` table. All the data in the column will be lost.
  - You are about to drop the column `targetAmountKobo` on the `pools` table. All the data in the column will be lost.
  - Added the required column `memberShareAmount` to the `pools` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetAmount` to the `pools` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "pools" DROP COLUMN "amountRaisedKobo",
DROP COLUMN "memberShareAmountKobo",
DROP COLUMN "targetAmountKobo",
ADD COLUMN     "amountRaised" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "memberShareAmount" INTEGER NOT NULL,
ADD COLUMN     "targetAmount" INTEGER NOT NULL;
