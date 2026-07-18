-- AlterTable
ALTER TABLE "pools" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
