import { IsOptional, IsUUID } from 'class-validator';

export class GetProductImagesQueryDto {
  @IsUUID('4', { message: 'Variant ID must be a valid UUID' })
  @IsOptional()
  variantId?: string;
}
