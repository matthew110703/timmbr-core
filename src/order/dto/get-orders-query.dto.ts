import { PaginationDto } from '@/common/dto/pagination.dto';
import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export type AdminOrderSortField = 'createdAt' | 'placedAt' | 'grandTotal';
export type OrderSortDirection = 'asc' | 'desc';

export class GetOrdersQueryDto extends PaginationDto {
  /**
   * One status or several, comma-separated (`?status=CONFIRMED,PROCESSING,SHIPPED`)
   * or repeated (`?status=CONFIRMED&status=SHIPPED`).
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
  })
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus[];

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  unacknowledgedOnly?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  paidOnly?: boolean;

  @IsOptional()
  @IsEnum(['createdAt', 'placedAt', 'grandTotal'], {
    message: 'sortBy must be createdAt, placedAt, or grandTotal',
  })
  sortBy?: AdminOrderSortField;

  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'order must be asc or desc' })
  order?: OrderSortDirection;
}
