import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '@/config/env';
import { OTP_TTL_S } from '@/auth/auth.constants';
import { resetPasswordEmailTemplate } from './templates/reset-password-email.template';
import { otpEmailTemplate } from './templates/otp-email.template';
import {
  invoiceEmailTemplate,
  InvoiceEmailTemplateParams,
} from './templates/invoice-email.template';
import { sanitizeInvoicePdfFileName } from '@/invoice/utils/invoice-number.util';

export interface SendInvoiceEmailOptions extends InvoiceEmailTemplateParams {
  to: string;
  pdfBuffer: Buffer;
  attachmentFileName?: string;
}

@Injectable()
export class MailerService {
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY);
  }

  async sendOtpEmail(to: string, name: string | null, otpCode: string): Promise<void> {
    const firstName = name ? name.split(' ')[0] : null;

    const { error } = await this.resend.emails.send({
      from: env.MAIL_FROM,
      to,
      subject: `${otpCode} is your Timmbr verification code`,
      html: otpEmailTemplate(firstName, otpCode, Math.floor(OTP_TTL_S / 60)),
    });

    if (error) {
      throw new InternalServerErrorException('Failed to send verification OTP email.');
    }
  }

  async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    const firstName = name.split(' ')[0];

    const { error } = await this.resend.emails.send({
      from: env.MAIL_FROM,
      to,
      subject: 'Reset your Timmbr password',
      html: resetPasswordEmailTemplate(firstName, resetUrl),
    });

    if (error) {
      throw new InternalServerErrorException('Failed to send password reset email.');
    }
  }

  async sendInvoiceEmail(options: SendInvoiceEmailOptions): Promise<void> {
    const safeFileName =
      options.attachmentFileName ?? sanitizeInvoicePdfFileName(options.invoiceNumber);

    const { error } = await this.resend.emails.send({
      from: env.MAIL_FROM,
      to: options.to,
      subject: `Your Timmbr Tax Invoice (${options.invoiceNumber})`,
      html: invoiceEmailTemplate({
        customerName: options.customerName,
        invoiceNumber: options.invoiceNumber,
        issuedDateFormatted: options.issuedDateFormatted,
        grandTotalFormatted: options.grandTotalFormatted,
      }),
      attachments: [
        {
          filename: safeFileName,
          content: options.pdfBuffer,
        },
      ],
    });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to send invoice email: ${error.message || 'Unknown email provider error'}`,
      );
    }
  }
}
