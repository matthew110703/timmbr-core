import { Test, TestingModule } from '@nestjs/testing';
import { OrderAdminController } from './order.admin.controller';
import { OrderService } from '../order.service';
import { OrderStatus } from '@prisma/client';

describe('OrderAdminController', () => {
  let controller: OrderAdminController;
  let service: jest.Mocked<OrderService>;

  const mockOrderResponse = {
    id: 'order-uuid-1',
    userId: 'user-uuid-1',
    cartId: null,
    status: OrderStatus.CONFIRMED,
    subtotal: 1000,
    discount: 0,
    shippingFee: 0,
    tax: 180,
    grandTotal: 1000,
    currency: 'INR',
    shippingAddressId: 'addr-uuid-1',
    shippingAddress: {},
    placedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  const mockAdminOrderListItem = {
    id: 'order-uuid-1',
    status: OrderStatus.CONFIRMED,
    paymentStatus: null,
    grandTotal: 1000,
    currency: 'INR',
    itemsCount: 1,
    customer: {
      id: 'user-uuid-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: null,
    },
    placedAt: new Date(),
    expiresAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockOrderService = {
      getAdminOrders: jest.fn().mockResolvedValue({
        data: [mockAdminOrderListItem],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
      getAdminOrderById: jest.fn().mockResolvedValue(mockOrderResponse),
      updateOrderStatus: jest.fn().mockResolvedValue({
        ...mockOrderResponse,
        status: OrderStatus.PROCESSING,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderAdminController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    }).compile();

    controller = module.get<OrderAdminController>(OrderAdminController);
    service = module.get(OrderService);
  });

  it('lists orders for admin', async () => {
    const query = { page: 1, limit: 20 };
    const result = await controller.getAdminOrders(query);
    expect(service.getAdminOrders).toHaveBeenCalledWith(query);
    expect(result.data).toHaveLength(1);
  });

  it('gets order details by id for admin', async () => {
    const result = await controller.getAdminOrderById('order-uuid-1');
    expect(service.getAdminOrderById).toHaveBeenCalledWith('order-uuid-1');
    expect(result.id).toBe('order-uuid-1');
  });

  it('updates order status', async () => {
    const result = await controller.updateOrderStatus('order-uuid-1', {
      status: OrderStatus.PROCESSING,
    });
    expect(service.updateOrderStatus).toHaveBeenCalledWith('order-uuid-1', OrderStatus.PROCESSING);
    expect(result.status).toBe(OrderStatus.PROCESSING);
  });
});
