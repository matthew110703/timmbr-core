import { MailerService } from './mailer.service';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from '@/config/env';

jest.mock('nodemailer');
jest.mock('resend');

describe('MailerService', () => {
  let mockTransporter: { sendMail: jest.Mock };
  let mockResendSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    mockResendSend = jest.fn().mockResolvedValue({ data: { id: 're-123' }, error: null });
    (Resend as unknown as jest.Mock).mockImplementation(() => ({
      emails: { send: mockResendSend },
    }));
  });

  describe('with SMTP transport', () => {
    beforeEach(() => {
      (env as any).MAIL_TRANSPORT = 'smtp';
      (env as any).SMTP_HOST = 'localhost';
      (env as any).SMTP_PORT = 1025;
      (env as any).SMTP_SECURE = false;
      (env as any).MAIL_FROM = 'no-reply@timmbr.com';
    });

    it('creates nodemailer transport and sends OTP email via SMTP', async () => {
      const service = new MailerService();
      await service.sendOtpEmail('user@example.com', 'Alex Doe', '123456');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 1025,
          secure: false,
        }),
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: '123456 is your Timmbr verification code',
        }),
      );
    });

    it('sends password reset email via SMTP', async () => {
      const service = new MailerService();
      await service.sendPasswordResetEmail(
        'user@example.com',
        'Alex Doe',
        'http://localhost:5000/reset',
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset your Timmbr password',
        }),
      );
    });

    it('sends invoice email with PDF attachment via SMTP', async () => {
      const service = new MailerService();
      const pdfBuffer = Buffer.from('fake pdf content');

      await service.sendInvoiceEmail({
        to: 'customer@example.com',
        customerName: 'Aarav',
        invoiceNumber: 'INV/26-27/000001',
        issuedDateFormatted: '02 Jun 2026',
        grandTotalFormatted: '₹2,224.00',
        pdfBuffer,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Your Timmbr Tax Invoice (INV/26-27/000001)',
          attachments: [
            expect.objectContaining({
              filename: 'INV_26-27_000001.pdf',
              content: pdfBuffer,
            }),
          ],
        }),
      );
    });
  });

  describe('with Resend transport', () => {
    beforeEach(() => {
      (env as any).MAIL_TRANSPORT = 'resend';
      (env as any).RESEND_API_KEY = 're_test_key';
      (env as any).MAIL_FROM = 'no-reply@timmbr.com';
    });

    it('creates Resend instance and sends email via Resend', async () => {
      const service = new MailerService();
      await service.sendOtpEmail('user@example.com', 'Alex', '654321');

      expect(Resend).toHaveBeenCalledWith('re_test_key');
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: '654321 is your Timmbr verification code',
        }),
      );
    });
  });
});
