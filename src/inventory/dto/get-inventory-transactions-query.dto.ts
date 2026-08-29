import { PaginationDto } from '@/common/dto/pagination.dto';
import { InventoryTransactionType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class GetInventoryTransactionsQueryDto extends PaginationDto {
  @IsEnum(InventoryTransactionType, { message: 'Invalid transaction type' })
  @IsOptional()
  type?: InventoryTransactionType;
}
