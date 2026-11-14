import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PERMISSIONS } from '@/common/constants/permissions.constant';
import { RequirePermissions, ResponseMessage, Roles } from '@/common/decorators';
import { TRANSACTION_ROUTES } from '../transaction.routes';
import { TransactionAdminService } from '../services/transaction.admin.service';
import { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';
import { TransactionListItemDto } from '../dto/transaction-response.dto';
import { PaginatedResult } from '@/common/types/api-response.types';

@Controller(TRANSACTION_ROUTES.ADMIN_TRANSACTIONS)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class TransactionAdminController {
  constructor(private readonly transactionAdminService: TransactionAdminService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TRANSACTIONS_READ)
  @ResponseMessage('Transactions fetched successfully.')
  async getAll(
    @Query() query: GetTransactionsQueryDto,
  ): Promise<PaginatedResult<TransactionListItemDto>> {
    return this.transactionAdminService.getAll(query);
  }
}
