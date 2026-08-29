import { Module } from '@nestjs/common';
import { InventoryAdminController } from './controllers/inventory.admin.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';

@Module({
  controllers: [InventoryAdminController],
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService, InventoryRepository],
})
export class InventoryModule {}
