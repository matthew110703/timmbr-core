import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { InvoiceModule } from '@/invoice/invoice.module';
import { RazorpayService } from './razorpay.service';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import { PaymentController } from './controllers/payment.controller';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [PaymentController],
  providers: [RazorpayService, PaymentRepository, PaymentService],
  exports: [RazorpayService, PaymentRepository, PaymentService],
})
export class PaymentModule {}
