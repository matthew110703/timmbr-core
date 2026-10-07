import { WishlistItemResponseDto } from './wishlist-item-response.dto';

export class WishlistResponseDto {
  id!: string;
  items!: WishlistItemResponseDto[];
  itemCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
