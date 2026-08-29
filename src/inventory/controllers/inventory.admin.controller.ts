import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '@/auth/types/jwt.types';
import { InventoryService } from '../inventory.service';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';
import { AdjustInventoryDto } from '../dto/adjust-inventory.dto';
import { GetInventoryTransactionsQueryDto } from '../dto/get-inventory-transactions-query.dto';
import { INVENTORY_ROUTES } from '../inventory.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.INVENTORY}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class InventoryAdminController {
  constructor(private readonly service: InventoryService) {}

  @Get(INVENTORY_ROUTES.TRANSACTIONS)
  @ResponseMessage('Inventory transactions fetched successfully.')
  getTransactions(
    @Param('variantId') variantId: string,
    @Query() query: GetInventoryTransactionsQueryDto,
  ) {
    return this.service.getTransactions(variantId, query);
  }

  @Get(INVENTORY_ROUTES.BY_VARIANT_ID)
  @ResponseMessage('Inventory fetched successfully.')
  getByVariantId(@Param('variantId') variantId: string) {
    return this.service.getByVariantId(variantId);
  }

  @Patch(INVENTORY_ROUTES.BY_VARIANT_ID)
  @HttpCode(200)
  @ResponseMessage('Inventory updated successfully.')
  update(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateInventoryDto,
    @Req() req: FastifyRequest,
  ) {
    const user = req.user as unknown as JwtPayload | undefined;
    return this.service.updateQuantity(variantId, dto, user?.sub);
  }

  @Post(INVENTORY_ROUTES.ADJUST)
  @HttpCode(200)
  @ResponseMessage('Inventory adjusted successfully.')
  adjust(
    @Param('variantId') variantId: string,
    @Body() dto: AdjustInventoryDto,
    @Req() req: FastifyRequest,
  ) {
    const user = req.user as unknown as JwtPayload | undefined;
    return this.service.adjustQuantity(variantId, dto, user?.sub);
  }
}
