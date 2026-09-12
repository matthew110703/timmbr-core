import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from '../order.service';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

describe('OrderController', () => {
  let controller: OrderController;
  let service: jest.Mocked<OrderService>;

  const mockOrderResponse = {
    id: 'order-uuid-1',
    userId: 'user-uuid-1',
    cartId: null,
    status: OrderStatus.PENDING,
    subtotal: 1000,
    discount: 0,
    shippingFee: 0,
    tax: 180,
    grandTotal: 1000,
    currency: 'INR',
    shippingAddressId: 'addr-uuid-1',
    shippingAddress: {},
    placedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  beforeEach(async () => {
    const mockOrderService = {
      createOrder: jest.fn().mockResolvedValue({
        order: mockOrderResponse,
        payment: {
          id: 'pay-uuid-1',
          provider: PaymentProvider.RAZORPAY,
          status: PaymentStatus.PENDING,
          amount: 1000,
          currency: 'INR',
          razorpayOrderId: 'order_rzp_123',
          razorpayKeyId: 'rzp_key_123',
        },
      }),
      getUserOrders: jest.fn().mockResolvedValue({
        data: [mockOrderResponse],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
      getUserOrderById: jest.fn().mockResolvedValue(mockOrderResponse),
      getUserOrderPayment: jest.fn().mockResolvedValue({
        id: 'pay-uuid-1',
        orderId: 'order-uuid-1',
        provider: PaymentProvider.RAZORPAY,
        status: PaymentStatus.PAID,
        amount: 1000,
        currency: 'INR',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    service = module.get(OrderService);
  });

  it('creates an order and returns payment parameters', async () => {
    const req: any = { user: { sub: 'user-uuid-1' } };
    const dto = {
      shippingAddressId: 'addr-uuid-1',
      items: [{ variantId: 'var-uuid-1', quantity: 1 }],
    };

    const result = await controller.createOrder(req, dto);
    expect(service.createOrder).toHaveBeenCalledWith('user-uuid-1', dto);
    expect(result.order.id).toBe('order-uuid-1');
    expect(result.payment.razorpayOrderId).toBe('order_rzp_123');
  });

  it('gets user orders with pagination', async () => {
    const req: any = { user: { sub: 'user-uuid-1' } };
    const result = await controller.getUserOrders(req, { page: 1, limit: 20 });
    expect(service.getUserOrders).toHaveBeenCalledWith('user-uuid-1', { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
  });

  it('gets user order by id', async () => {
    const req: any = { user: { sub: 'user-uuid-1' } };
    const result = await controller.getUserOrderById(req, 'order-uuid-1');
    expect(service.getUserOrderById).toHaveBeenCalledWith('user-uuid-1', 'order-uuid-1');
    expect(result.id).toBe('order-uuid-1');
  });

  it('gets order payment', async () => {
    const req: any = { user: { sub: 'user-uuid-1' } };
    const result = await controller.getOrderPayment(req, 'order-uuid-1');
    expect(service.getUserOrderPayment).toHaveBeenCalledWith('user-uuid-1', 'order-uuid-1');
    expect(result.id).toBe('pay-uuid-1');
  });
});
