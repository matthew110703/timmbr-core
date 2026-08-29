import { InventoryTransactionType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  NotEquals,
} from 'class-validator';

export class AdjustInventoryDto {
  @IsInt({ message: 'Delta must be an integer' })
  @NotEquals(0, { message: 'Delta cannot be zero' })
  delta!: number;

  @IsString({ message: 'Reason must be a string' })
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  @MaxLength(50, { message: 'Reason cannot exceed 50 characters' })
  @IsOptional()
  reason?: string;

  @IsEnum(InventoryTransactionType, { message: 'Invalid transaction type' })
  @IsOptional()
  type?: InventoryTransactionType;

  @IsString({ message: 'Reference type must be a string' })
  @MinLength(3, { message: 'Reference type must be at least 3 characters' })
  @MaxLength(20, { message: 'Reference type cannot exceed 20 characters' })
  @IsOptional()
  referenceType?: string;

  @IsString({ message: 'Reference ID must be a string' })
  @MinLength(3, { message: 'Reference ID must be at least 3 characters' })
  @MaxLength(20, { message: 'Reference ID cannot exceed 20 characters' })
  @IsOptional()
  referenceId?: string;
}
