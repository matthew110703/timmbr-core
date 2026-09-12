import { Test, TestingModule } from '@nestjs/testing';
import { RazorpayService } from './razorpay.service';
import * as crypto from 'crypto';
import {
  InvalidPaymentSignatureException,
  InvalidWebhookSignatureException,
} from '@/common/exceptions/payment.exception';

const mockKeyId = 'rzp_test_123456';
const mockKeySecret = 'test_secret_key_123456';
const mockWebhookSecret = 'test_webhook_secret_123456';

jest.mock('@/config/env', () => ({
  env: {
    RAZORPAY_KEY_ID: 'rzp_test_123456',
    RAZORPAY_KEY_SECRET: 'test_secret_key_123456',
    RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret_123456',
  },
}));

describe('RazorpayService', () => {
  let service: RazorpayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RazorpayService],
    }).compile();

    service = module.get<RazorpayService>(RazorpayService);
  });

  it('returns keyId', () => {
    expect(service.getKeyId()).toBe(mockKeyId);
  });

  describe('verifyPaymentSignature', () => {
    it('verifies a valid payment signature successfully', () => {
      const orderId = 'order_123456';
      const paymentId = 'pay_123456';
      const payload = `${orderId}|${paymentId}`;
      const signature = crypto.createHmac('sha256', mockKeySecret).update(payload).digest('hex');

      const result = service.verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      });

      expect(result).toBe(true);
    });

    it('throws InvalidPaymentSignatureException when signature is invalid', () => {
      expect(() =>
        service.verifyPaymentSignature({
          razorpayOrderId: 'order_123456',
          razorpayPaymentId: 'pay_123456',
          razorpaySignature: 'invalid_signature_hex_value_here',
        }),
      ).toThrow(InvalidPaymentSignatureException);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('verifies a valid webhook signature successfully', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawBody)
        .digest('hex');

      const result = service.verifyWebhookSignature(rawBody, signature);
      expect(result).toBe(true);
    });

    it('throws InvalidWebhookSignatureException when signature is missing or invalid', () => {
      expect(() => service.verifyWebhookSignature('{}', 'invalid_signature_hex')).toThrow(
        InvalidWebhookSignatureException,
      );
    });
  });
});
