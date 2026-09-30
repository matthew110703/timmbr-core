import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { APP_ROUTES } from '@/app.routes';
import { CART_ROUTES } from './cart.routes';
import { CartService } from './cart.service';
import { OptionalAuth, ResponseMessage } from '@/common/decorators';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { CART_CONSTANTS, getGuestCartCookieOptions } from './cart.constants';
import { JwtPayload } from '@/auth/types/jwt.types';
import { CartContext } from './types/cart.types';

@Controller(APP_ROUTES.CART)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private extractContext(req: FastifyRequest): CartContext {
    const user = req.user as JwtPayload | undefined;
    const guestCartId = req.cookies?.[CART_CONSTANTS.GUEST_CART_COOKIE] ?? null;
    return {
      userId: user?.sub ?? null,
      guestCartId,
    };
  }

  @Get(CART_ROUTES.ROOT)
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Cart retrieved successfully.')
  async getCart(@Req() req: FastifyRequest): Promise<CartResponseDto> {
    const context = this.extractContext(req);
    return this.cartService.getCart(context);
  }

  @Post(CART_ROUTES.ITEMS)
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Item added to cart.')
  async addItem(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    const context = this.extractContext(req);
    const { cart, newGuestCartId } = await this.cartService.addItem(context, dto);

    if (newGuestCartId) {
      reply.setCookie(
        CART_CONSTANTS.GUEST_CART_COOKIE,
        newGuestCartId,
        getGuestCartCookieOptions(),
      );
    }

    return cart;
  }

  @Patch(CART_ROUTES.ITEM_BY_ID)
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Cart item updated successfully.')
  async updateItemQuantity(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const context = this.extractContext(req);
    return this.cartService.updateItemQuantity(context, itemId, dto);
  }

  @Delete(CART_ROUTES.ITEM_BY_ID)
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Item removed from cart.')
  async removeItem(
    @Req() req: FastifyRequest,
    @Param('itemId') itemId: string,
  ): Promise<CartResponseDto> {
    const context = this.extractContext(req);
    return this.cartService.removeItem(context, itemId);
  }

  @Delete(CART_ROUTES.ROOT)
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Cart cleared successfully.')
  async clearCart(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<CartResponseDto> {
    const context = this.extractContext(req);
    const { cart, shouldClearCookie } = await this.cartService.clearCart(context);

    if (shouldClearCookie) {
      reply.clearCookie(CART_CONSTANTS.GUEST_CART_COOKIE, { path: '/' });
    }

    return cart;
  }

  @Post(CART_ROUTES.MERGE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Guest cart merged successfully.')
  async mergeCart(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<CartResponseDto> {
    const user = req.user as unknown as JwtPayload;
    const guestCartId = req.cookies?.[CART_CONSTANTS.GUEST_CART_COOKIE] ?? null;

    const cart = await this.cartService.mergeCart(user.sub, guestCartId);

    // Clear guest cart cookie on login merge
    reply.clearCookie(CART_CONSTANTS.GUEST_CART_COOKIE, { path: '/' });

    return cart;
  }
}
