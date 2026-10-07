import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddWishlistItemDto {
  @IsUUID('all', { message: 'Variant ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Variant ID is required' })
  variantId!: string;
}
