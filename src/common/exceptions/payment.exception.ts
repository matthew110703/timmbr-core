import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export class PaymentNotFoundException extends NotFoundException {
  constructor(message = 'Payment record not found.') {
    super({ message, code: 'PAYMENT_NOT_FOUND' });
  }
}

export class InvalidPaymentSignatureException extends BadRequestException {
  constructor(message = 'Invalid Razorpay payment signature.') {
    super({ message, code: 'INVALID_PAYMENT_SIGNATURE' });
  }
}

export class InvalidWebhookSignatureException extends BadRequestException {
  constructor(message = 'Invalid Razorpay webhook signature.') {
    super({ message, code: 'INVALID_WEBHOOK_SIGNATURE' });
  }
}

export class RazorpayOrderCreationFailedException extends InternalServerErrorException {
  constructor(message = 'Failed to create order on Razorpay.') {
    super({ message, code: 'RAZORPAY_ORDER_CREATION_FAILED' });
  }
}

export class PaymentAlreadyCompletedException extends BadRequestException {
  constructor(message = 'Payment has already been completed.') {
    super({ message, code: 'PAYMENT_ALREADY_COMPLETED' });
  }
}
