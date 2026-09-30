-- DropIndex
ALTER TABLE "Cart" DROP CONSTRAINT IF EXISTS "Cart_userId_key";
DROP INDEX IF EXISTS "Cart_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Cart_one_active_per_user" ON "Cart"("userId") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cart_userId_status_idx" ON "Cart"("userId", "status");
