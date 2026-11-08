import { Test, TestingModule } from '@nestjs/testing';
import { OrderAdminController } from './order.admin.controller';
import { OrderService } from '../order.service';
import { OrderStatus, UserRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

describe('OrderAdminController', () => {
  let controller: OrderAdminController;
  let service: jest.Mocked<OrderService>;

  const mockOrderResponse = {
    id: 'order-uuid-1',
    orderNumber: '#TMB-ORDERUUI',
    userId: 'user-uuid-1',
    cartId: null,
    status: OrderStatus.CONFIRMED,
    subtotal: 1000,
    discount: 0,
    shippingFee: 0,
    tax: 180,
    grandTotal: 1000,
    currency: 'INR',
    paymentMethod: null,
    acknowledgedAt: null,
    acknowledgedById: null,
    installationRequired: false,
    shippingAddressId: 'addr-uuid-1',
    shippingAddress: {},
    placedAt: new Date(),
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  const mockAdminOrderListItem = {
    id: 'order-uuid-1',
    orderNumber: '#TMB-ORDERUUI',
    status: OrderStatus.CONFIRMED,
    paymentStatus: null,
    paymentMethod: null,
    thumbnail: null,
    acknowledgedAt: null,
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

  const makeReq = (user?: any): FastifyRequest =>
    ({
      user: user ?? { sub: 'admin-1', role: UserRole.ADMIN, permissions: [] },
    }) as unknown as FastifyRequest;

  beforeEach(async () => {
    const mockOrderService = {
      getDashboardStats: jest.fn().mockResolvedValue({
        counts: { newOrders: 1, processing: 2, outForDelivery: 0, completed: 5 },
        recentOrders: [mockAdminOrderListItem],
      }),
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
      acknowledgeOrder: jest.fn().mockResolvedValue({
        ...mockOrderResponse,
        acknowledgedAt: new Date(),
        acknowledgedById: 'staff-1',
      }),
      updateOrderStatus: jest.fn().mockResolvedValue({
        ...mockOrderResponse,
        status: OrderStatus.PROCESSING,
      }),
      getAdminOrderActivities: jest.fn().mockResolvedValue({
        orderId: 'order-uuid-1',
        hasManufacturingStarted: false,
        pendingCancellationRequest: null,
        activities: [],
      }),
      recordOrderActivity: jest.fn().mockResolvedValue({
        id: 'act-1',
        orderId: 'order-uuid-1',
        eventType: 'MANUFACTURING_STARTED',
      }),
      createCustomerUpdate: jest.fn().mockResolvedValue({
        id: 'act-2',
        orderId: 'order-uuid-1',
        eventType: 'CUSTOMER_UPDATE',
      }),
      cancelOrder: jest.fn().mockResolvedValue({
        order: { ...mockOrderResponse, status: OrderStatus.CANCELLED },
        cancellationState: 'CANCELLED',
        activity: { id: 'act-3' },
      }),
      approveCancellation: jest.fn().mockResolvedValue({
        order: { ...mockOrderResponse, status: OrderStatus.CANCELLED },
        cancellationState: 'CANCELLED',
        activity: { id: 'act-4' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderAdminController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    }).compile();

    controller = module.get<OrderAdminController>(OrderAdminController);
    service = module.get(OrderService);
  });

  it('fetches dashboard statistics', async () => {
    const result = await controller.getDashboardStats();
    expect(service.getDashboardStats).toHaveBeenCalled();
    expect(result.counts.newOrders).toBe(1);
  });

  it('lists orders for admin without enforcing paidOnly', async () => {
    const query = { page: 1, limit: 20 };
    const result = await controller.getAdminOrders(makeReq(), query);
    expect(service.getAdminOrders).toHaveBeenCalledWith(query, { enforcePaidOnly: false });
    expect(result.data).toHaveLength(1);
  });

  it('enforces paidOnly when listing orders for STAFF', async () => {
    const query = { page: 1, limit: 20 };
    await controller.getAdminOrders(
      makeReq({ sub: 'staff-1', role: UserRole.STAFF, permissions: ['orders:read'] }),
      query,
    );
    expect(service.getAdminOrders).toHaveBeenCalledWith(query, { enforcePaidOnly: true });
  });

  it('gets order details by id for admin', async () => {
    const result = await controller.getAdminOrderById('order-uuid-1');
    expect(service.getAdminOrderById).toHaveBeenCalledWith('order-uuid-1');
    expect(result.id).toBe('order-uuid-1');
  });

  it('acknowledges a confirmed order', async () => {
    const result = await controller.acknowledgeOrder(
      makeReq({ sub: 'staff-1', role: UserRole.STAFF }),
      'order-uuid-1',
    );
    expect(service.acknowledgeOrder).toHaveBeenCalledWith('order-uuid-1', 'staff-1');
    expect(result.acknowledgedById).toBe('staff-1');
  });

  it('updates order status with actor context', async () => {
    const req = makeReq({
      sub: 'staff-1',
      role: UserRole.STAFF,
      permissions: ['orders:update'],
    });
    const result = await controller.updateOrderStatus(req, 'order-uuid-1', {
      status: OrderStatus.PROCESSING,
      notes: 'Starting production',
    });
    expect(service.updateOrderStatus).toHaveBeenCalledWith('order-uuid-1', OrderStatus.PROCESSING, {
      userId: 'staff-1',
      role: UserRole.STAFF,
      permissions: ['orders:update'],
      notes: 'Starting production',
      verificationCode: undefined,
    });
    expect(result.status).toBe(OrderStatus.PROCESSING);
  });
});
