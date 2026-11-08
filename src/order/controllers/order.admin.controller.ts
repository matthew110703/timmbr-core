import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { RequirePermissions, ResponseMessage, Roles } from '@/common/decorators';
import { STAFF_PERMISSIONS } from '@/common/constants/permissions.constant';
import { Application } from '@/common/types/application.types';
import { JwtPayload } from '@/auth/types/jwt.types';
import { UserRole } from '@prisma/client';
import { ORDER_ROUTES } from '../order.routes';
import { OrderService } from '../order.service';
import { GetOrdersQueryDto } from '../dto/get-orders-query.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { AdminOrderListItemDto, OrderResponseDto } from '../dto/order-response.dto';
import { DashboardStatsResponseDto } from '../dto/dashboard-stats-response.dto';
import {
  CreateOrderActivityDto,
  OrderActivityResponseDto,
  OrderTimelineResponseDto,
} from '../dto/order-activity.dto';
import {
  ApproveCancellationDto,
  CancelOrderDto,
  CancelOrderResponseDto,
} from '../dto/cancel-order.dto';
import { CreateCustomerUpdateDto } from '../dto/create-customer-update.dto';
import { PaginatedResult } from '@/common/types/api-response.types';

@Controller(ORDER_ROUTES.ADMIN_ORDERS)
@Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.STAFF)
export class OrderAdminController {
  constructor(private readonly orderService: OrderService) {}

  @Get(ORDER_ROUTES.DASHBOARD_STATS)
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_READ)
  @ResponseMessage('Dashboard statistics fetched successfully.')
  async getDashboardStats(): Promise<DashboardStatsResponseDto> {
    return this.orderService.getDashboardStats();
  }

  @Get()
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_READ)
  @ResponseMessage('Orders fetched successfully.')
  async getAdminOrders(
    @Req() req: FastifyRequest,
    @Query() query: GetOrdersQueryDto,
  ): Promise<PaginatedResult<AdminOrderListItemDto>> {
    const user = req.user as unknown as JwtPayload | undefined;
    const enforcePaidOnly =
      user?.role === UserRole.STAFF || req.application === Application.STAFF_COMPANION;
    return this.orderService.getAdminOrders(query, { enforcePaidOnly });
  }

  @Get(':orderId')
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_READ)
  @ResponseMessage('Order fetched successfully.')
  async getAdminOrderById(@Param('orderId') orderId: string): Promise<OrderResponseDto> {
    return this.orderService.getAdminOrderById(orderId);
  }

  @Post(ORDER_ROUTES.ACKNOWLEDGE)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_UPDATE)
  @ResponseMessage('Order acknowledged successfully.')
  async acknowledgeOrder(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.acknowledgeOrder(orderId, user.sub);
  }

  @Patch(ORDER_ROUTES.STATUS)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_UPDATE)
  @ResponseMessage('Order status updated successfully.')
  async updateOrderStatus(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const user = req.user as unknown as JwtPayload | undefined;
    return this.orderService.updateOrderStatus(
      orderId,
      dto.status,
      user
        ? {
            userId: user.sub,
            role: user.role,
            permissions: user.permissions,
            notes: dto.notes,
            verificationCode: dto.verificationCode,
          }
        : undefined,
    );
  }

  @Get(ORDER_ROUTES.ACTIVITIES)
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_READ)
  @ResponseMessage('Order activity timeline fetched successfully.')
  async getOrderActivities(@Param('orderId') orderId: string): Promise<OrderTimelineResponseDto> {
    return this.orderService.getAdminOrderActivities(orderId);
  }

  @Post(ORDER_ROUTES.ACTIVITIES)
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_UPDATE)
  @ResponseMessage('Order activity recorded successfully.')
  async recordOrderActivity(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderActivityDto,
  ): Promise<OrderActivityResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.recordOrderActivity(orderId, user.sub, dto);
  }

  @Post(ORDER_ROUTES.CUSTOMER_UPDATES)
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_MESSAGE)
  @ResponseMessage('Customer update recorded successfully.')
  async createCustomerUpdate(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
    @Body() dto: CreateCustomerUpdateDto,
  ): Promise<OrderActivityResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.createCustomerUpdate(orderId, user.sub, dto);
  }

  @Post(ORDER_ROUTES.CANCEL)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(STAFF_PERMISSIONS.ORDERS_CANCEL)
  @ResponseMessage('Order cancellation processed successfully.')
  async cancelOrder(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
    @Body() dto: CancelOrderDto,
  ): Promise<CancelOrderResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.cancelOrder(orderId, { userId: user.sub, role: user.role }, dto);
  }

  @Post(ORDER_ROUTES.CANCEL_APPROVE)
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.MASTER)
  @ResponseMessage('Order cancellation approved successfully.')
  async approveCancellation(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
    @Body() dto: ApproveCancellationDto,
  ): Promise<CancelOrderResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.approveCancellation(orderId, user.sub, dto);
  }
}
