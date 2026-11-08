import { PaginationDto } from '@/common/dto/pagination.dto';
import { PaymentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetTransactionsQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
  })
  @IsEnum(PaymentStatus, { each: true })
  status?: PaymentStatus[];

  @IsOptional()
  @IsString()
  search?: string;
}
