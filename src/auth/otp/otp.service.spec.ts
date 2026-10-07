import { Test } from '@nestjs/testing';
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
import { SmsService } from '../sms/sms.service';
import { OtpService } from './otp.service';

const redis = {
  setIfAbsent: jest.fn(),
  incrementWithExpiry: jest.fn(),
  setWithTTL: jest.fn(),
  delete: jest.fn(),
  ttl: jest.fn(),
  get: jest.fn(),
  consumeIfEquals: jest.fn(),
};
const mailer = { sendOtpEmail: jest.fn() };
const sms = { isAvailable: true, sendOtp: jest.fn() };

describe('OtpService', () => {
  let service: OtpService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: RedisService, useValue: redis },
        { provide: MailerService, useValue: mailer },
        { provide: SmsService, useValue: sms },
      ],
    }).compile();
    service = module.get(OtpService);

    sms.isAvailable = true;
    redis.setIfAbsent.mockResolvedValue(true);
    redis.incrementWithExpiry.mockResolvedValue(1);
    redis.ttl.mockResolvedValue(42);
    redis.get.mockResolvedValue(null);
  });

  afterEach(() => jest.resetAllMocks());

  describe('send', () => {
    it('emails a 6-digit code and returns timing metadata, not account existence', async () => {
      const result = await service.send('Dany@Example.com');

      const code = mailer.sendOtpEmail.mock.calls[0][2] as string;
      expect(code).toMatch(/^\d{6}$/);
      expect(mailer.sendOtpEmail).toHaveBeenCalledWith('dany@example.com', null, code);
      expect(result).toEqual({
        destination: 'd**y@example.com',
        codeLength: 6,
        expiresIn: 600,
        resendAvailableIn: 60,
      });
      expect(result).not.toHaveProperty('isNewUser');
    });

    it('builds Redis keys from a hash, never from the raw identifier', async () => {
      await service.send('dany@example.com');

      const keys = [
        ...redis.setIfAbsent.mock.calls.map((c) => c[0]),
        ...redis.setWithTTL.mock.calls.map((c) => c[0]),
      ] as string[];
      keys.forEach((k) => expect(k).toMatch(/^auth:otp:[0-9a-f]{64}:\w+$/));
    });

    it('rejects invalid identifiers', async () => {
      await expect(service.send('rate:victim@x.com')).rejects.toThrow(InvalidIdentifierException);
    });

    it('enforces the cooldown atomically with the remaining wait', async () => {
      redis.setIfAbsent.mockResolvedValue(false);

      await expect(service.send('dany@example.com')).rejects.toThrow(OtpCooldownException);
      expect(mailer.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('enforces the hourly cap', async () => {
      redis.incrementWithExpiry.mockResolvedValue(6);

      await expect(service.send('dany@example.com')).rejects.toThrow(OtpRateLimitedException);
    });

    it('releases the cooldown and code when delivery fails', async () => {
      mailer.sendOtpEmail.mockRejectedValue(new Error('smtp down'));

      await expect(service.send('dany@example.com')).rejects.toThrow('smtp down');
      expect(redis.delete).toHaveBeenLastCalledWith(
        expect.stringMatching(/:code$/),
        expect.stringMatching(/:cooldown$/),
      );
    });

    it('sends phone codes over SMS in E.164', async () => {
      await service.send('98765 43210');

      expect(sms.sendOtp).toHaveBeenCalledWith('+919876543210', expect.stringMatching(/^\d{6}$/));
    });

    it('rejects phone login when no SMS gateway is available', async () => {
      sms.isAvailable = false;

      await expect(service.send('9876543210')).rejects.toThrow(PhoneLoginUnavailableException);
      expect(redis.setIfAbsent).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('returns the normalised identifier when the code matches', async () => {
      redis.consumeIfEquals.mockResolvedValue('consumed');

      await expect(service.verify('9876543210', '123456')).resolves.toEqual({
        type: 'phone',
        value: '+919876543210',
      });
    });

    it('reports an expired/missing code', async () => {
      redis.consumeIfEquals.mockResolvedValue('missing');

      await expect(service.verify('a@b.co', '123456')).rejects.toThrow(OtpExpiredException);
    });

    it('counts wrong guesses and reports attempts left', async () => {
      redis.consumeIfEquals.mockResolvedValue('mismatch');
      redis.incrementWithExpiry.mockResolvedValue(2);

      const err = await service.verify('a@b.co', '000000').catch((e: OtpInvalidException) => e);

      expect(err).toBeInstanceOf(OtpInvalidException);
      expect((err as OtpInvalidException).getResponse()).toMatchObject({
        details: { attemptsLeft: 3 },
      });
    });

    it('burns the code on the 5th wrong guess', async () => {
      redis.consumeIfEquals.mockResolvedValue('mismatch');
      redis.incrementWithExpiry.mockResolvedValue(5);

      await expect(service.verify('a@b.co', '000000')).rejects.toThrow(OtpLockedException);
      expect(redis.delete).toHaveBeenCalledWith(expect.stringMatching(/:code$/));
    });

    it('refuses to check codes while locked', async () => {
      redis.get.mockResolvedValue('5');

      await expect(service.verify('a@b.co', '123456')).rejects.toThrow(OtpLockedException);
      expect(redis.consumeIfEquals).not.toHaveBeenCalled();
    });
  });
});
