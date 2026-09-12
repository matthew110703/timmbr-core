import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ResponseMessage, Roles } from '@/common/decorators';
import { UserRole } from '@prisma/client';
import { ORDER_ROUTES } from '../order.routes';
import { OrderService } from '../order.service';
import { GetOrdersQueryDto } from '../dto/get-orders-query.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { AdminOrderListItemDto, OrderResponseDto } from '../dto/order-response.dto';
import { PaginatedResult } from '@/common/types/api-response.types';

@Controller(ORDER_ROUTES.ADMIN_ORDERS)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class OrderAdminController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @ResponseMessage('Orders fetched successfully.')
  async getAdminOrders(
    @Query() query: GetOrdersQueryDto,
  ): Promise<PaginatedResult<AdminOrderListItemDto>> {
    return this.orderService.getAdminOrders(query);
  }

  @Get(':orderId')
  @ResponseMessage('Order fetched successfully.')
  async getAdminOrderById(@Param('orderId') orderId: string): Promise<OrderResponseDto> {
    return this.orderService.getAdminOrderById(orderId);
  }

  @Patch(ORDER_ROUTES.STATUS)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Order status updated successfully.')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.orderService.updateOrderStatus(orderId, dto.status);
  }
}
