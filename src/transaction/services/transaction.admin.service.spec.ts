import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { TransactionAdminService } from './transaction.admin.service';
import { TransactionRepository } from '../transaction.repository';
import { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';

describe('TransactionAdminService', () => {
  let service: TransactionAdminService;
  let repository: TransactionRepository;

  const mockPaymentRecord = {
    id: 'pay-uuid-1',
    orderId: '5008524c-abc6-4042-8be8-3bba1086e08d',
    provider: PaymentProvider.RAZORPAY,
    providerOrderId: 'order_rzp_123',
    providerPaymentId: 'pay_rzp_456',
    amount: new Prisma.Decimal('53100.00'),
    currency: 'INR',
    status: PaymentStatus.PAID,
    createdAt: new Date('2026-11-08T08:00:00.000Z'),
    updatedAt: new Date('2026-11-08T08:05:00.000Z'),
    order: {
      id: '5008524c-abc6-4042-8be8-3bba1086e08d',
      status: OrderStatus.CONFIRMED,
      userId: 'user-uuid-1',
      shippingAddress: {
        firstName: 'Rohan',
        lastName: 'Sharma',
        email: 'rohan.shipping@example.com',
        phone: '+919876543210',
      },
      user: {
        id: 'user-uuid-1',
        name: 'Rohan Sharma',
        email: 'rohan@example.com',
        phone: '+919876543210',
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionAdminService,
        {
          provide: TransactionRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[mockPaymentRecord], 1]),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionAdminService>(TransactionAdminService);
    repository = module.get<TransactionRepository>(TransactionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns paginated transactions with formatted order number and customer details', async () => {
    const query: GetTransactionsQueryDto = { page: 1, limit: 20 };
    const result = await service.getAll(query);

    expect(repository.findPaginated).toHaveBeenCalledWith({}, 1, 20);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'pay-uuid-1',
      orderId: '5008524c-abc6-4042-8be8-3bba1086e08d',
      orderNumber: '#TMB-5008524C',
      orderStatus: OrderStatus.CONFIRMED,
      provider: PaymentProvider.RAZORPAY,
      amount: 53100,
      currency: 'INR',
      status: PaymentStatus.PAID,
      customer: {
        id: 'user-uuid-1',
        name: 'Rohan Sharma',
        email: 'rohan@example.com',
        phone: '+919876543210',
      },
    });
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('applies status filter when status array is provided', async () => {
    const query: GetTransactionsQueryDto = {
      page: 1,
      limit: 10,
      status: [PaymentStatus.PAID, PaymentStatus.FAILED],
    };

    await service.getAll(query);

    expect(repository.findPaginated).toHaveBeenCalledWith(
      {
        status: { in: [PaymentStatus.PAID, PaymentStatus.FAILED] },
      },
      1,
      10,
    );
  });

  it('applies text search filter across payment, order, and customer attributes', async () => {
    const query: GetTransactionsQueryDto = {
      page: 1,
      limit: 20,
      search: 'pay_rzp_456',
    };

    await service.getAll(query);

    expect(repository.findPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        OR: expect.arrayContaining([
          { id: { contains: 'pay_rzp_456', mode: 'insensitive' } },
          { providerPaymentId: { contains: 'pay_rzp_456', mode: 'insensitive' } },
          { providerOrderId: { contains: 'pay_rzp_456', mode: 'insensitive' } },
          { orderId: { contains: 'pay_rzp_456', mode: 'insensitive' } },
          { order: { user: { name: { contains: 'pay_rzp_456', mode: 'insensitive' } } } },
          { order: { user: { email: { contains: 'pay_rzp_456', mode: 'insensitive' } } } },
        ]),
      }),
      1,
      20,
    );
  });

  it('normalizes #TMB- order number search correctly', async () => {
    const query: GetTransactionsQueryDto = {
      page: 1,
      limit: 20,
      search: '#TMB-5008524C',
    };

    await service.getAll(query);

    expect(repository.findPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        OR: expect.arrayContaining([{ orderId: { contains: '5008524C', mode: 'insensitive' } }]),
      }),
      1,
      20,
    );
  });

  it('falls back to shippingAddress when user relation is missing', async () => {
    const guestPayment = {
      ...mockPaymentRecord,
      order: {
        ...mockPaymentRecord.order,
        userId: 'guest-user-1',
        user: null,
      },
    };
    (repository.findPaginated as jest.Mock).mockResolvedValueOnce([[guestPayment], 1]);

    const result = await service.getAll({});

    expect(result.data[0].customer).toEqual({
      id: 'guest-user-1',
      name: 'Rohan Sharma',
      email: 'rohan.shipping@example.com',
      phone: '+919876543210',
    });
  });
});
