import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { OTP_TTL_S } from '@/auth/auth.constants';
import { resetPasswordEmailTemplate } from './templates/reset-password-email.template';
import { inviteUserEmailTemplate } from './templates/invite-user-email.template';
import { otpEmailTemplate } from './templates/otp-email.template';
import {
  invoiceEmailTemplate,
  InvoiceEmailTemplateParams,
} from './templates/invoice-email.template';
import {
  orderUpdateEmailTemplate,
  OrderUpdateEmailTemplateParams,
} from './templates/order-update-email.template';
import { sanitizeInvoicePdfFileName } from '@/invoice/utils/invoice-number.util';

export interface SendInvoiceEmailOptions extends InvoiceEmailTemplateParams {
  to: string;
  pdfBuffer: Buffer;
  attachmentFileName?: string;
}

export interface SendOrderUpdateEmailOptions extends OrderUpdateEmailTemplateParams {
  to: string;
}

interface InternalSendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resend: Resend | null = null;
  private readonly transporter: Transporter | null = null;

  constructor() {
    if (env.MAIL_TRANSPORT === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth:
          env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
      this.logger.log(
        `Initialized MailerService with SMTP transport (${env.SMTP_HOST}:${env.SMTP_PORT})`,
      );
    } else {
      this.resend = new Resend(env.RESEND_API_KEY);
      this.logger.log('Initialized MailerService with Resend transport');
    }
  }

  private async dispatchEmail(options: InternalSendMailOptions): Promise<void> {
    if (env.MAIL_TRANSPORT === 'smtp' && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: env.MAIL_FROM,
          to: options.to,
          subject: options.subject,
          html: options.html,
          attachments: options.attachments,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          { err: msg, to: options.to, subject: options.subject },
          'Failed to deliver email via SMTP',
        );
        throw new InternalServerErrorException(`Failed to send email via SMTP: ${msg}`);
      }
      return;
    }

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: env.MAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });

      if (error) {
        const msg = error.message || 'Unknown Resend error';
        this.logger.error(
          { err: msg, to: options.to, subject: options.subject },
          'Failed to deliver email via Resend',
        );
        throw new InternalServerErrorException(`Failed to send email: ${msg}`);
      }
      return;
    }

    throw new InternalServerErrorException('No email transport configured');
  }

  async sendOtpEmail(to: string, name: string | null, otpCode: string): Promise<void> {
    const firstName = name ? name.split(' ')[0] : null;

    await this.dispatchEmail({
      to,
      subject: `${otpCode} is your Timmbr verification code`,
      html: otpEmailTemplate(firstName, otpCode, Math.floor(OTP_TTL_S / 60)),
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    const firstName = name.split(' ')[0];

    await this.dispatchEmail({
      to,
      subject: 'Reset your Timmbr password',
      html: resetPasswordEmailTemplate(firstName, resetUrl),
    });
  }

  async sendUserInviteEmail(options: {
    to: string;
    name: string;
    role: string;
    inviteUrl: string;
  }): Promise<void> {
    const firstName = options.name ? options.name.split(' ')[0] : 'there';

    await this.dispatchEmail({
      to: options.to,
      subject: "You're invited to join Timmbr",
      html: inviteUserEmailTemplate(firstName, options.role, options.inviteUrl),
    });
  }

  async sendInvoiceEmail(options: SendInvoiceEmailOptions): Promise<void> {
    const safeFileName =
      options.attachmentFileName ?? sanitizeInvoicePdfFileName(options.invoiceNumber);

    await this.dispatchEmail({
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
  }

  async sendOrderUpdateEmail(options: SendOrderUpdateEmailOptions): Promise<void> {
    await this.dispatchEmail({
      to: options.to,
      subject: `Update on your Timmbr order (${options.orderNumber})`,
      html: orderUpdateEmailTemplate({
        customerName: options.customerName,
        orderNumber: options.orderNumber,
        orderStatus: options.orderStatus,
        updateCategory: options.updateCategory,
        message: options.message,
      }),
    });
  }
}
