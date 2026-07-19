-- Pool.category (PoolCategory enum) -> Pool.categoryId (FK to categories.id)
--
-- Data migration: add the FK column nullable, backfill it by matching the
-- old enum text to categories.name (categories were seeded 1:1 with the
-- PoolCategory enum values), then tighten to NOT NULL before dropping the
-- old column and enum type.

-- AddColumn (nullable for now, backfilled below)
ALTER TABLE "pools" ADD COLUMN "categoryId" TEXT;

-- Backfill
UPDATE "pools" p
SET "categoryId" = c."id"
FROM "categories" c
WHERE c."name" = p."category"::text;

-- Guard: fail loudly instead of silently dropping rows with no matching category
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "pools" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'pool_category_fk migration: found pools with no matching category row';
  END IF;
END $$;

-- Now safe to require it
ALTER TABLE "pools" ALTER COLUMN "categoryId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropColumn
ALTER TABLE "pools" DROP COLUMN "category";

-- DropEnum
DROP TYPE "PoolCategory";
