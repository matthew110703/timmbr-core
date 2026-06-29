import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '@/config/env';
import { verificationEmailTemplate } from './templates/verification-email.template';
import { resetPasswordEmailTemplate } from './templates/reset-password-email.template';

@Injectable()
export class MailerService {
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY);
  }

  async sendVerificationEmail(to: string, name: string, verificationUrl: string): Promise<void> {
    const firstName = name.split(' ')[0];

    const { error } = await this.resend.emails.send({
      from: env.MAIL_FROM,
      to,
      subject: 'Verify your Timmbr account',
      html: verificationEmailTemplate(firstName, verificationUrl),
    });

    if (error) {
      throw new InternalServerErrorException('Failed to send verification email.');
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
