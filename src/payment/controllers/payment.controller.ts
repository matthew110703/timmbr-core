import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '@/auth/types/jwt.types';
import { PAYMENT_ROUTES } from '../payment.routes';
import { PaymentService, VerifyPaymentResult } from '../payment.service';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@Controller(PAYMENT_ROUTES.PAYMENTS)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(PAYMENT_ROUTES.RAZORPAY_VERIFY)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Payment verified and order confirmed successfully.')
  async verifyRazorpayPayment(
    @Req() req: FastifyRequest,
    @Body() dto: VerifyPaymentDto,
  ): Promise<VerifyPaymentResult> {
    const user = req.user as unknown as JwtPayload;
    return this.paymentService.verifyPayment(user.sub, dto);
  }
}
