import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { APP_ROUTES } from '@/app.routes';
import { JwtPayload } from '@/auth/types/jwt.types';
import { ResponseMessage } from '@/common/decorators';
import { WishlistService } from './wishlist.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { WISHLIST_ROUTES } from './wishlist.routes';

@Controller(APP_ROUTES.WISHLIST)
export class WishlistController {
  constructor(private wishlist: WishlistService) {}

  @Get(WISHLIST_ROUTES.ROOT)
  @ResponseMessage('Wishlist fetched successfully.')
  getWishlist(@Req() req: FastifyRequest) {
    const user = req.user as unknown as JwtPayload;
    return this.wishlist.getWishlist(user.sub);
  }

  @Post(WISHLIST_ROUTES.ITEMS)
  @HttpCode(201)
  @ResponseMessage('Item added to wishlist.')
  addItem(@Req() req: FastifyRequest, @Body() dto: AddWishlistItemDto) {
    const user = req.user as unknown as JwtPayload;
    return this.wishlist.addItem(user.sub, dto);
  }

  @Delete(WISHLIST_ROUTES.ITEM_BY_VARIANT)
  @ResponseMessage('Item removed from wishlist.')
  removeItem(@Req() req: FastifyRequest, @Param('variantId') variantId: string) {
    const user = req.user as unknown as JwtPayload;
    return this.wishlist.removeItem(user.sub, variantId);
  }

  @Get(WISHLIST_ROUTES.CHECK)
  @ResponseMessage('Wishlist status fetched successfully.')
  check(@Req() req: FastifyRequest, @Param('variantId') variantId: string) {
    const user = req.user as unknown as JwtPayload;
    return this.wishlist.check(user.sub, variantId);
  }
}
