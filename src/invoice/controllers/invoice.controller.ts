import { Controller, Get, Param, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '@/auth/types/jwt.types';
import { ResponseMessage } from '@/common/decorators';
import { INVOICE_ROUTES } from '../invoice.routes';
import { InvoiceService } from '../invoice.service';
import { InvoiceDownloadResponseDto, InvoiceResponseDto } from '../dto/invoice-response.dto';

@Controller(INVOICE_ROUTES.CUSTOMER_ORDER_INVOICE)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get(INVOICE_ROUTES.INVOICE_BY_ORDER)
  @ResponseMessage('Invoice fetched successfully.')
  async getOrderInvoice(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
  ): Promise<InvoiceResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.invoiceService.getCustomerInvoiceByOrderId(user.sub, orderId);
  }

  @Get(INVOICE_ROUTES.INVOICE_DOWNLOAD_BY_ORDER)
  @ResponseMessage('Invoice download URL generated successfully.')
  async downloadOrderInvoice(
    @Req() req: FastifyRequest,
    @Param('orderId') orderId: string,
  ): Promise<InvoiceDownloadResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.invoiceService.getCustomerInvoiceDownloadUrl(user.sub, orderId);
  }
}
