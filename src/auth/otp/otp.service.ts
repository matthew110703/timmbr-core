import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { RedisService } from '@/redis/redis.service';
import { MailerService } from '@/mailer/mailer.service';
import {
  InvalidIdentifierException,
  OtpCooldownException,
  OtpExpiredException,
  OtpInvalidException,
  OtpLockedException,
  OtpRateLimitedException,
  PhoneLoginUnavailableException,
} from '@/common/exceptions/auth.exception';
import {
  OTP_COOLDOWN_S,
  OTP_LENGTH,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_TTL_S,
} from '../auth.constants';
import { SmsService } from '../sms/sms.service';
import { Identifier, maskIdentifier, normalizeIdentifier } from '../utils/identifier.util';

export interface OtpSendResult {
  destination: string;
  codeLength: number;
  expiresIn: number;
  resendAvailableIn: number;
}

const RATE_WINDOW_S = 60 * 60;

/**
 * Redis keys are derived from a hash of the normalised identifier, so user
 * input never becomes part of a key (no `rate:victim@x.com` collisions).
 */
function otpKeys(id: Identifier) {
  const h = crypto.createHash('sha256').update(`${id.type}:${id.value}`).digest('hex');
  const base = `auth:otp:${h}`;
  return {
    code: `${base}:code`,
    cooldown: `${base}:cooldown`,
    rate: `${base}:rate`,
    fails: `${base}:fails`,
  };
}

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly mailer: MailerService,
    private readonly sms: SmsService,
  ) {}

  parseIdentifier(raw: string): Identifier {
    const id = normalizeIdentifier(raw);
    if (!id) throw new InvalidIdentifierException();
    return id;
  }

  async send(rawIdentifier: string): Promise<OtpSendResult> {
    const id = this.parseIdentifier(rawIdentifier);
    if (id.type === 'phone' && !this.sms.isAvailable) {
      throw new PhoneLoginUnavailableException();
    }

    const keys = otpKeys(id);

    // Atomic cooldown gate: parallel requests can't both pass.
    if (!(await this.redis.setIfAbsent(keys.cooldown, OTP_COOLDOWN_S, '1'))) {
      throw new OtpCooldownException(await this.redis.ttl(keys.cooldown));
    }

    const sends = await this.redis.incrementWithExpiry(keys.rate, RATE_WINDOW_S);
    if (sends > OTP_MAX_SENDS_PER_HOUR) {
      throw new OtpRateLimitedException(await this.redis.ttl(keys.rate));
    }

    const code = crypto
      .randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
    await this.redis.setWithTTL(keys.code, OTP_TTL_S, code);
    await this.redis.delete(keys.fails);

    try {
      if (id.type === 'email') {
        await this.mailer.sendOtpEmail(id.value, null, code);
      } else {
        await this.sms.sendOtp(id.value, code);
      }
    } catch (err) {
      // Nothing was delivered: don't burn the user's cooldown or leave a live code.
      await this.redis.delete(keys.code, keys.cooldown);
      throw err;
    }

    return {
      destination: maskIdentifier(id),
      codeLength: OTP_LENGTH,
      expiresIn: OTP_TTL_S,
      resendAvailableIn: OTP_COOLDOWN_S,
    };
  }

  /** Consume a code. Returns the normalised identifier it was issued for. */
  async verify(rawIdentifier: string, code: string): Promise<Identifier> {
    const id = this.parseIdentifier(rawIdentifier);
    const keys = otpKeys(id);

    const fails = Number((await this.redis.get(keys.fails)) ?? 0);
    if (fails >= OTP_MAX_FAILED_ATTEMPTS) {
      throw new OtpLockedException(await this.redis.ttl(keys.fails));
    }

    // Compare-and-delete in one step: two parallel verifies can't both succeed.
    const result = await this.redis.consumeIfEquals(keys.code, code);
    if (result === 'consumed') {
      await this.redis.delete(keys.fails);
      return id;
    }
    if (result === 'missing') {
      throw new OtpExpiredException();
    }

    const failed = await this.redis.incrementWithExpiry(keys.fails, OTP_TTL_S);
    if (failed >= OTP_MAX_FAILED_ATTEMPTS) {
      // Burn the code; the user must request a fresh one.
      await this.redis.delete(keys.code);
      throw new OtpLockedException(await this.redis.ttl(keys.fails));
    }
    throw new OtpInvalidException(OTP_MAX_FAILED_ATTEMPTS - failed);
  }
}
