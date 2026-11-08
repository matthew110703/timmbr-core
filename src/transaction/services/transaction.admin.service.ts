import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from '@/common/types/api-response.types';
import { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';
import { TransactionListItemDto } from '../dto/transaction-response.dto';
import { TransactionMapper } from '../transaction.mapper';
import { TransactionRepository } from '../transaction.repository';

@Injectable()
export class TransactionAdminService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async getAll(query: GetTransactionsQueryDto): Promise<PaginatedResult<TransactionListItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.PaymentWhereInput = {
      ...(query.status && query.status.length > 0 && { status: { in: query.status } }),
    };

    if (query.search?.trim()) {
      const rawSearch = query.search.trim();
      const cleanedOrderSearch = rawSearch.replace(/^#?TMB-?/i, '').trim();

      where.OR = [
        { id: { contains: rawSearch, mode: 'insensitive' } },
        { providerPaymentId: { contains: rawSearch, mode: 'insensitive' } },
        { providerOrderId: { contains: rawSearch, mode: 'insensitive' } },
        ...(cleanedOrderSearch
          ? [{ orderId: { contains: cleanedOrderSearch, mode: 'insensitive' as const } }]
          : []),
        { order: { user: { name: { contains: rawSearch, mode: 'insensitive' } } } },
        { order: { user: { email: { contains: rawSearch, mode: 'insensitive' } } } },
        { order: { user: { phone: { contains: rawSearch, mode: 'insensitive' } } } },
        { order: { shippingAddress: { path: ['phone'], string_contains: rawSearch } } },
        { order: { shippingAddress: { path: ['firstName'], string_contains: rawSearch } } },
        { order: { shippingAddress: { path: ['lastName'], string_contains: rawSearch } } },
      ];
    }

    const [payments, total] = await this.transactionRepository.findPaginated(where, page, limit);

    const totalPages = Math.ceil(total / limit);

    return {
      data: payments.map((p) => TransactionMapper.toListItem(p)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
