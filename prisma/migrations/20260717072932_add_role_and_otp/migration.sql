-- CreateEnum
CREATE TYPE "Role" AS ENUM ('User', 'Admin');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "otp" TEXT NOT NULL DEFAULT '0000',
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'User';
