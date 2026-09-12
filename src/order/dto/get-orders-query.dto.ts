import { PaginationDto } from '@/common/dto/pagination.dto';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetOrdersQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
