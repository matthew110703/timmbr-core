import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from '../webhook.service';
import { OrderService } from '@/order/order.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let service: jest.Mocked<WebhookService>;
  let orderService: jest.Mocked<OrderService>;

  beforeEach(async () => {
    const mockService = {
      handleRazorpayWebhook: jest.fn().mockResolvedValue({ received: true }),
    };

    const mockOrderService = {
      cleanupExpiredOrders: jest.fn().mockResolvedValue({
        success: true,
        processedCount: 5,
        hasMore: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: WebhookService, useValue: mockService },
        { provide: OrderService, useValue: mockOrderService },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    service = module.get(WebhookService);
    orderService = module.get(OrderService);
  });

  it('handles razorpay webhook request', async () => {
    const payload = { event: 'payment.captured' };
    const rawBodyStr = JSON.stringify(payload);
    const req: any = { body: payload, rawBody: rawBodyStr };
    const signature = 'sig_test_123';

    const result = await controller.handleRazorpayWebhook(req, signature, payload);
    expect(service.handleRazorpayWebhook).toHaveBeenCalledWith(rawBodyStr, signature, payload);
    expect(result.received).toBe(true);
  });

  it('handles orders cleanup webhook request', async () => {
    const result = await controller.cleanupExpiredOrders();
    expect(orderService.cleanupExpiredOrders).toHaveBeenCalledWith(500);
    expect(result).toEqual({
      success: true,
      processedCount: 5,
      hasMore: false,
    });
  });
});
