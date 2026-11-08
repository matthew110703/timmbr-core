import { Module } from '@nestjs/common';
import { TransactionAdminController } from './controllers/transaction.admin.controller';
import { TransactionAdminService } from './services/transaction.admin.service';
import { TransactionRepository } from './transaction.repository';

@Module({
  controllers: [TransactionAdminController],
  providers: [TransactionAdminService, TransactionRepository],
  exports: [TransactionAdminService, TransactionRepository],
})
export class TransactionModule {}
