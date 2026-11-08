import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const CUSTOMER_UPDATE_CATEGORIES = [
  'PREDEFINED_UPDATE',
  'CUSTOM_MESSAGE',
  'MANUFACTURING_UPDATE',
  'DELAY_NOTIFICATION',
  'DELIVERY_COORDINATION',
] as const;

export type CustomerUpdateCategory = (typeof CUSTOMER_UPDATE_CATEGORIES)[number];

export const PREDEFINED_CUSTOMER_UPDATE_TEMPLATES: Record<string, string> = {
  MANUFACTURING_STARTED: 'Manufacturing has started on your order.',
  IN_PRODUCTION: 'Your furniture is currently being manufactured.',
  PRODUCTION_DELAY: 'There is a slight delay in production. We appreciate your patience.',
  QUALITY_CHECK_PASSED: 'Your furniture has passed quality inspection.',
  DELIVERY_COORDINATION: 'We would like to coordinate your delivery.',
};

export class CreateCustomerUpdateDto {
  @IsIn(CUSTOMER_UPDATE_CATEGORIES)
  category!: CustomerUpdateCategory;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateKey?: string;

  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
