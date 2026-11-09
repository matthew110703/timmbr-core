-- CreateIndex
CREATE INDEX "Review_productId_status_helpfulCount_idx" ON "Review"("productId", "status", "helpfulCount");

-- CreateIndex
CREATE INDEX "Review_productId_status_rating_createdAt_idx" ON "Review"("productId", "status", "rating", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewMedia_createdAt_idx" ON "ReviewMedia"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_productId_idx" ON "OrderItem"("orderId", "productId");
