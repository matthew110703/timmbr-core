import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { TransactionAdminController } from './transaction.admin.controller';
import { TransactionAdminService } from '../services/transaction.admin.service';
import { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';

describe('TransactionAdminController', () => {
  let controller: TransactionAdminController;
  let service: TransactionAdminService;

  const mockTransactionListItem = {
    id: 'pay-uuid-1',
    orderId: 'order-uuid-1',
    orderNumber: '#TMB-5008524C',
    orderStatus: OrderStatus.CONFIRMED,
    provider: PaymentProvider.RAZORPAY,
    providerOrderId: 'order_rzp_123',
    providerPaymentId: 'pay_rzp_456',
    amount: 53100,
    currency: 'INR',
    status: PaymentStatus.PAID,
    customer: {
      id: 'cust-uuid-1',
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      phone: '+919876543210',
    },
    createdAt: new Date('2026-11-08T08:00:00.000Z'),
    updatedAt: new Date('2026-11-08T08:05:00.000Z'),
  };

  const mockPaginatedResult = {
    data: [mockTransactionListItem],
    meta: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionAdminController],
      providers: [
        {
          provide: TransactionAdminService,
          useValue: {
            getAll: jest.fn().mockResolvedValue(mockPaginatedResult),
          },
        },
      ],
    }).compile();

    controller = module.get<TransactionAdminController>(TransactionAdminController);
    service = module.get<TransactionAdminService>(TransactionAdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates query to TransactionAdminService.getAll', async () => {
    const query: GetTransactionsQueryDto = {
      page: 1,
      limit: 20,
      status: [PaymentStatus.PAID],
      search: 'pay_rzp_456',
    };

    const result = await controller.getAll(query);

    expect(service.getAll).toHaveBeenCalledWith(query);
    expect(result).toEqual(mockPaginatedResult);
  });
});
