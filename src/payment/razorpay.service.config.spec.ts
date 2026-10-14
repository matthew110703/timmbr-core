import { env } from '@/config/env';
import {
  InvalidPaymentSignatureException,
  InvalidWebhookSignatureException,
  RazorpayOrderCreationFailedException,
} from '@/common/exceptions/payment.exception';
import { RazorpayService } from './razorpay.service';

// Mutable stand-in for the validated env, so each test can choose its configuration.
jest.mock('@/config/env', () => ({ env: {} }));

const configure = (values: Record<string, string | undefined>) => {
  for (const key of Object.keys(env)) delete (env as Record<string, unknown>)[key];
  Object.assign(env, values);
};

const verifyArgs = {
  razorpayOrderId: 'order_1',
  razorpayPaymentId: 'pay_1',
  razorpaySignature: 'anything',
};

describe('RazorpayService without secrets', () => {
  describe('in production', () => {
    beforeEach(() => configure({ NODE_ENV: 'prod' }));

    it('rejects a payment verification instead of accepting it unsigned', () => {
      const service = new RazorpayService();

      expect(() => service.verifyPaymentSignature(verifyArgs)).toThrow(
        InvalidPaymentSignatureException,
      );
    });

    it('rejects webhooks instead of accepting them unsigned', () => {
      const service = new RazorpayService();

      expect(() => service.verifyWebhookSignature('{}', 'sig')).toThrow(
        InvalidWebhookSignatureException,
      );
    });

    it('refuses to create an order instead of returning a mock one', async () => {
      const service = new RazorpayService();

      await expect(service.createOrder({ amount: 100 })).rejects.toThrow(
        RazorpayOrderCreationFailedException,
      );
    });
  });

  describe('in development (mock mode)', () => {
    beforeEach(() => configure({ NODE_ENV: 'dev' }));

    it('accepts unsigned payments and webhooks, and returns a mock order', async () => {
      const service = new RazorpayService();

      expect(service.verifyPaymentSignature(verifyArgs)).toBe(true);
      expect(service.verifyWebhookSignature('{}', '')).toBe(true);
      await expect(service.createOrder({ amount: 100 })).resolves.toMatchObject({
        id: expect.stringMatching(/^order_mock_/),
      });
    });
  });
});
