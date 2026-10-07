import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '@/config/env';
import { resetPasswordEmailTemplate } from './templates/reset-password-email.template';
import { otpEmailTemplate } from './templates/otp-email.template';

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
      html: otpEmailTemplate(firstName, otpCode),
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
}
