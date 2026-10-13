-- Foreign keys without an index make every delete of the parent row scan the child table
-- (e.g. deleting a variant scanned all product images). Also speeds up order/stock history lookups.

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryId_idx" ON "InventoryTransaction"("inventoryId");
-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");
-- CreateIndex
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
