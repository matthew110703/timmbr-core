import { Injectable, Logger } from '@nestjs/common';
import { env } from '@/config/env';

/**
 * Outbound SMS for phone OTPs. Swap the provider binding in AuthModule when a
 * real gateway (MSG91, Twilio, …) is added.
 */
export abstract class SmsService {
  /** Whether phone OTP can be delivered in this environment. */
  abstract readonly isAvailable: boolean;
  abstract sendOtp(phone: string, code: string): Promise<void>;
}

/** Development only: logs the code instead of sending it. */
@Injectable()
export class DevSmsService extends SmsService {
  private readonly logger = new Logger('SmsService');
  readonly isAvailable = true;

  sendOtp(phone: string, code: string): Promise<void> {
    this.logger.warn(`[DEV ONLY] OTP for ${phone}: ${code}`);
    return Promise.resolve();
  }
}

/** No gateway configured: phone login is rejected before a code is generated. */
@Injectable()
export class UnavailableSmsService extends SmsService {
  readonly isAvailable = false;

  sendOtp(): Promise<void> {
    return Promise.reject(new Error('SMS gateway is not configured.'));
  }
}

export const smsServiceProvider = {
  provide: SmsService,
  useClass: env.NODE_ENV === 'dev' ? DevSmsService : UnavailableSmsService,
};
