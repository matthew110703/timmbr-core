import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Public, ResponseMessage } from '@/common/decorators';
import { OrderService } from '@/order/order.service';
import { OrderCleanupResponseDto } from '@/order/dto/order-cleanup-response.dto';
import { WEBHOOK_ROUTES } from '../webhook.routes';
import { WebhookService } from '../webhook.service';
import { CronSecretGuard } from '../guards/cron-secret.guard';

@Controller(WEBHOOK_ROUTES.WEBHOOKS)
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly orderService: OrderService,
  ) {}

  @Post(WEBHOOK_ROUTES.RAZORPAY)
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Webhook processed successfully.')
  async handleRazorpayWebhook(
    @Req() req: FastifyRequest,
    @Headers('x-razorpay-signature') signature: string,
    @Body() payload: any,
  ): Promise<{ received: boolean; idempotent?: boolean }> {
    const rawBody = (req as any).rawBody as string;
    return this.webhookService.handleRazorpayWebhook(rawBody, signature, payload);
  }

  @Post(WEBHOOK_ROUTES.ORDERS_CLEANUP)
  @Public()
  @UseGuards(CronSecretGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Order cleanup executed successfully.')
  async cleanupExpiredOrders(): Promise<OrderCleanupResponseDto> {
    return this.orderService.cleanupExpiredOrders(500);
  }
}
