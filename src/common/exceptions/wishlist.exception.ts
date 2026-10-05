import { ConflictException, NotFoundException } from '@nestjs/common';

export class WishlistItemNotFoundException extends NotFoundException {
  constructor(message = 'Item not found in wishlist.') {
    super({ message, code: 'WISHLIST_ITEM_NOT_FOUND' });
  }
}

export class WishlistItemAlreadyExistsException extends ConflictException {
  constructor(message = 'Item already exists in wishlist.') {
    super({ message, code: 'WISHLIST_ITEM_ALREADY_EXISTS' });
  }
}
