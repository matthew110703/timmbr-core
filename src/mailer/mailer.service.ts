import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '@/config/env';
import { verificationEmailTemplate } from './templates/verification-email.template';

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
}
