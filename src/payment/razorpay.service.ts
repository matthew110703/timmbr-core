import { Injectable, Logger } from '@nestjs/common';
import { env } from '@/config/env';
import * as crypto from 'crypto';
import {
  InvalidPaymentSignatureException,
  InvalidWebhookSignatureException,
  RazorpayOrderCreationFailedException,
} from '@/common/exceptions/payment.exception';

export interface CreateRazorpayOrderOptions {
  amount: number; // in paise (INR)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: string;
  attempts: number;
  notes?: Record<string, string>;
  created_at: number;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor() {
    this.keyId = env.RAZORPAY_KEY_ID || '';
    this.keySecret = env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || '';
  }

  getKeyId(): string {
    return this.keyId;
  }

  async createOrder(options: CreateRazorpayOrderOptions): Promise<RazorpayOrderResult> {
    if (!this.keyId || !this.keySecret) {
      this.logger.warn(
        'Razorpay keys are not configured. Returning a mock order for development/testing.',
      );
      return {
        id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        entity: 'order',
        amount: options.amount,
        amount_paid: 0,
        amount_due: options.amount,
        currency: options.currency ?? 'INR',
        receipt: options.receipt,
        status: 'created',
        attempts: 0,
        notes: options.notes,
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          amount: options.amount,
          currency: options.currency ?? 'INR',
          receipt: options.receipt,
          notes: options.notes,
          payment_capture: 1, // Automatic capture enabled
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Razorpay order creation failed: ${response.status} - ${errorBody}`);
        throw new RazorpayOrderCreationFailedException(`Razorpay error: ${errorBody}`);
      }

      return (await response.json()) as RazorpayOrderResult;
    } catch (error) {
      if (error instanceof RazorpayOrderCreationFailedException) {
        throw error;
      }
      this.logger.error('Failed to communicate with Razorpay API', error);
      throw new RazorpayOrderCreationFailedException('Communication error with Razorpay');
    }
  }

  verifyPaymentSignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    if (!this.keySecret) {
      this.logger.warn(
        'Razorpay key secret not configured. Bypassing signature verification in mock mode.',
      );
      return true;
    }

    if (!params.razorpaySignature) {
      throw new InvalidPaymentSignatureException();
    }

    const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuffer = Buffer.from(params.razorpaySignature, 'utf-8');

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      throw new InvalidPaymentSignatureException();
    }

    return true;
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'Razorpay webhook secret not configured. Bypassing webhook signature verification.',
      );
      return true;
    }

    if (!signature) {
      throw new InvalidWebhookSignatureException('Missing signature header.');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuffer = Buffer.from(signature, 'utf-8');

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      throw new InvalidWebhookSignatureException();
    }

    return true;
  }
}
