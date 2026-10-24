import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class BulkDeleteProductsDto {
  @IsArray({ message: 'productIds must be an array.' })
  @ArrayMinSize(1, { message: 'At least one product ID is required.' })
  @IsUUID('all', { each: true, message: 'Each product ID must be a valid UUID.' })
  productIds!: string[];
}
