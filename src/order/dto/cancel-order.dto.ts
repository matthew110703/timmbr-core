import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderResponseDto } from './order-response.dto';
import { OrderActivityResponseDto } from './order-activity.dto';

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;

  @IsOptional()
  @IsBoolean()
  requestApproval?: boolean;
}

export class ApproveCancellationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNotes?: string;
}

export class CancelOrderResponseDto {
  order!: OrderResponseDto;
  cancellationState!: 'CANCELLED' | 'APPROVAL_REQUESTED';
  activity!: OrderActivityResponseDto;
}
