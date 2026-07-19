-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- Seed data: one row per value of the PoolCategory enum (schema.prisma),
-- so the enum stays the source of truth for valid category codes while
-- this table carries the admin-manageable metadata (description, isActive).
INSERT INTO "categories" ("id", "name", "description", "isActive", "createdAt", "updatedAt") VALUES
    ('1e9d8011-cb58-4e96-a568-547c763413df', 'BulkPurchase', 'Bulk purchase — rice, gas, building materials, groceries', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('1cf21de1-1b33-4aeb-a3f0-4cc6cae31fa1', 'Ajo', 'Ajo/Esusu — rotating savings, monthly contributions', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('62441fcf-312f-4988-b283-8c6c2d96c7d6', 'Fundraising', 'Fundraising — medical bills, emergencies, community relief', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a45dc455-29ad-4ae1-96ec-6e43701a700d', 'Repair', 'Repair — home, community, or school repairs', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('1eb1c00d-6474-4c8c-93ed-dfafecb88d12', 'Investment', 'Investment — business capital, group projects', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('7fc9cbad-1ce5-43ec-9cc5-e69e83304d38', 'GroupGift', 'Group gift — birthday, wedding, farewell gifts', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('3a5397ea-e83a-4968-a51d-d9ecba85f1ed', 'Education', 'Education — school fees pooling, study materials', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('1291a375-bd1c-4bd5-b53c-fd82bb840e70', 'Custom', 'Custom — any other reason', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
