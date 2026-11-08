import { InvoiceEmailStatus, UserRole } from '@prisma/client';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export const ALLOWED_MANUFACTURING_EVENT_TYPES = [
  'MATERIAL_PREPARATION',
  'MANUFACTURING_STARTED',
  'MANUFACTURING_UPDATE',
  'QUALITY_CHECK_COMPLETED',
  'READY_FOR_DISPATCH',
  'DELIVERY_COORDINATION',
] as const;

export type ManufacturingEventType = (typeof ALLOWED_MANUFACTURING_EVENT_TYPES)[number];

export class CreateOrderActivityDto {
  @IsIn(ALLOWED_MANUFACTURING_EVENT_TYPES)
  eventType!: ManufacturingEventType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class OrderActivityStaffDto {
  id!: string;
  name!: string;
  role!: UserRole;
}

export class OrderNotificationDeliveryDto {
  id!: string;
  channel!: string;
  recipient!: string;
  status!: InvoiceEmailStatus;
  attempts!: number;
  sentAt!: Date | null;
  lastError!: string | null;
  createdAt!: Date;
}

export class OrderActivityResponseDto {
  id!: string;
  orderId!: string;
  staffId!: string | null;
  staff!: OrderActivityStaffDto | null;
  eventType!: string;
  description!: string;
  updateCategory!: string | null;
  isCustomerVisible!: boolean;
  metadata!: any;
  notification!: OrderNotificationDeliveryDto | null;
  createdAt!: Date;
}

export class OrderTimelineResponseDto {
  orderId!: string;
  hasManufacturingStarted!: boolean;
  pendingCancellationRequest!: OrderActivityResponseDto | null;
  activities!: OrderActivityResponseDto[];
}
