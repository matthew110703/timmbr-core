import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from '../payment.service';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: jest.Mocked<PaymentService>;

  beforeEach(async () => {
    const mockService = {
      verifyPayment: jest.fn().mockResolvedValue({
        payment: {
          id: 'pay-uuid-1',
          orderId: 'order-uuid-1',
          provider: PaymentProvider.RAZORPAY,
          providerOrderId: 'order_rzp_123',
          providerPaymentId: 'pay_rzp_123',
          amount: 1999,
          currency: 'INR',
          status: PaymentStatus.PAID,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        orderId: 'order-uuid-1',
        orderStatus: OrderStatus.CONFIRMED,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: mockService }],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    service = module.get(PaymentService);
  });

  it('verifies razorpay payment', async () => {
    const dto = {
      razorpayPaymentId: 'pay_rzp_123',
      razorpayOrderId: 'order_rzp_123',
      razorpaySignature: 'sig_123',
    };

    const result = await controller.verifyRazorpayPayment(dto);
    expect(service.verifyPayment).toHaveBeenCalledWith(dto);
    expect(result.orderStatus).toBe(OrderStatus.CONFIRMED);
    expect(result.payment.status).toBe(PaymentStatus.PAID);
  });
});
