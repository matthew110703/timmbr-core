import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '@/auth/types/jwt.types';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';
import { ORDER_ROUTES } from '../order.routes';
import { OrderService } from '../order.service';
import { CheckoutQuoteDto } from '../dto/checkout-quote.dto';
import { QuoteResponseDto } from '../dto/quote-response.dto';

@Controller(ORDER_ROUTES.CHECKOUT)
export class CheckoutController {
  constructor(private readonly orderService: OrderService) {}

  @Post(ORDER_ROUTES.QUOTE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Checkout quote calculated successfully.')
  async getQuote(
    @Req() req: FastifyRequest,
    @Body() dto: CheckoutQuoteDto,
  ): Promise<QuoteResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.orderService.getQuote(user.sub, dto);
  }
}
