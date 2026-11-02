import { Transform } from 'class-transformer';
import { IsEmail, IsOptional } from 'class-validator';

export class ResendInvoiceEmailDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  recipient?: string;
}
