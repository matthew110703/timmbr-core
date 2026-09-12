import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '@/auth/types/jwt.types';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';
import { ORDER_ROUTES } from '../order.routes';
import { OrderService } from '../order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { GetOrdersQueryDto } from '../dto/get-orders-query.dto';
import { CreateOrderResponseDto, OrderResponseDto } from '../dto/order-response.dto';
import { PaymentResponseDto } from '@/payment/dto/payment-response.dto';
import { PaginatedResult } from '@/common/types/api-response.types';

@Controller(ORDER_ROUTES.ORDERS)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Order created and payment initialized successfully.')
  async createOrder(
    @Req() req: FastifyRequest,
    @Body() dto: CreateOrderDto,
  ): Promise<CreateOrderResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.createOrder(user.sub, dto);
  }

  @Get()
  @ResponseMessage('Orders fetched successfully.')
  async getUserOrders(
    @Req() req: FastifyRequest,
    @Query() query: GetOrdersQueryDto,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.getUserOrders(user.sub, query);
  }

  @Get(':orderId')
  @ResponseMessage('Order fetched successfully.')
  async getUserOrderById(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.getUserOrderById(user.sub, orderId);
  }

  @Get(ORDER_ROUTES.PAYMENT)
  @ResponseMessage('Order payment fetched successfully.')
  async getOrderPayment(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
  ): Promise<PaymentResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.getUserOrderPayment(user.sub, orderId);
  }
}
