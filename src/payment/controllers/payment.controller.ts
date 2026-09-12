import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
  async verifyRazorpayPayment(@Body() dto: VerifyPaymentDto): Promise<VerifyPaymentResult> {
    return this.paymentService.verifyPayment(dto);
  }
}
