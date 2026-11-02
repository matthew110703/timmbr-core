import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '@/auth/types/jwt.types';
import { ResponseMessage, Roles } from '@/common/decorators';
import { PaginatedResult } from '@/common/types/api-response.types';
import { INVOICE_ROUTES } from '../invoice.routes';
import { InvoiceService } from '../invoice.service';
import { GetInvoicesQueryDto } from '../dto/get-invoices-query.dto';
import { VoidInvoiceDto } from '../dto/void-invoice.dto';
import { ResendInvoiceEmailDto } from '../dto/resend-invoice-email.dto';
import {
  AdminInvoiceListItemDto,
  InvoiceDownloadResponseDto,
  InvoiceEmailDeliveryResponseDto,
  InvoiceResponseDto,
} from '../dto/invoice-response.dto';

@Controller(INVOICE_ROUTES.ADMIN_INVOICES)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class InvoiceAdminController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @ResponseMessage('Invoices fetched successfully.')
  async getAdminInvoices(
    @Query() query: GetInvoicesQueryDto,
  ): Promise<PaginatedResult<AdminInvoiceListItemDto>> {
    return this.invoiceService.getAdminInvoices(query);
  }

  @Get(INVOICE_ROUTES.BY_ID)
  @ResponseMessage('Invoice fetched successfully.')
  async getAdminInvoiceById(@Param('invoiceId') invoiceId: string): Promise<InvoiceResponseDto> {
    return this.invoiceService.getAdminInvoiceById(invoiceId);
  }

  @Get(INVOICE_ROUTES.DOWNLOAD)
  @ResponseMessage('Invoice download URL generated successfully.')
  async downloadAdminInvoice(
    @Param('invoiceId') invoiceId: string,
  ): Promise<InvoiceDownloadResponseDto> {
    return this.invoiceService.getAdminInvoiceDownloadUrl(invoiceId);
  }

  @Post(INVOICE_ROUTES.RETRY_PDF)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Invoice PDF regeneration queued successfully.')
  async retryPdfGeneration(
    @Req() req: FastifyRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<InvoiceResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.invoiceService.retryPdfGeneration(invoiceId, user.sub);
  }

  @Post(INVOICE_ROUTES.RESEND_EMAIL)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Invoice email delivery queued successfully.')
  async resendInvoiceEmail(
    @Req() req: FastifyRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: ResendInvoiceEmailDto,
  ): Promise<InvoiceEmailDeliveryResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.invoiceService.resendInvoiceEmail(invoiceId, user.sub, dto);
  }

  /**
   * Only Super Admin (`UserRole.MASTER`) can void an issued invoice.
   */
  @Patch(INVOICE_ROUTES.VOID)
  @Roles(UserRole.MASTER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Invoice voided successfully.')
  async voidInvoice(
    @Req() req: FastifyRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: VoidInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const user = req.user as unknown as JwtPayload;
    return this.invoiceService.voidInvoice(invoiceId, user.sub, dto);
  }
}
