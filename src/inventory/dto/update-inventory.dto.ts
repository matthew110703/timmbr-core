import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateInventoryDto {
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(0, { message: 'Quantity cannot be less than 0' })
  quantity!: number;

  @IsString({ message: 'Reason must be a string' })
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  @MaxLength(50, { message: 'Reason cannot exceed 50 characters' })
  @IsOptional()
  reason?: string;

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
