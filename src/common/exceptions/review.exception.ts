import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class ReviewNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Review not found.', code: 'REVIEW_NOT_FOUND' });
  }
}

export class ReviewForbiddenException extends ForbiddenException {
  constructor() {
    super({ message: 'You do not have access to this review.', code: 'REVIEW_FORBIDDEN' });
  }
}

export class ReviewNotEligibleException extends UnprocessableEntityException {
  constructor() {
    super({
      message: 'You are not eligible to review this product for this order.',
      code: 'REVIEW_NOT_ELIGIBLE',
    });
  }
}

export class ReviewAlreadyExistsException extends ConflictException {
  constructor() {
    super({
      message: 'A review already exists for this product on this order.',
      code: 'REVIEW_ALREADY_EXISTS',
    });
  }
}

export class ReviewRevisionNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Review revision not found.', code: 'REVIEW_REVISION_NOT_FOUND' });
  }
}

export class ReviewInvalidStorageKeyException extends UnprocessableEntityException {
  constructor(storageKey: string) {
    super({
      message: `Invalid storage key for this review: ${storageKey}.`,
      code: 'REVIEW_INVALID_STORAGE_KEY',
    });
  }
}

export class ReviewMediaObjectNotFoundException extends UnprocessableEntityException {
  constructor(storageKey: string) {
    super({
      message: `Uploaded object not found in storage: ${storageKey}.`,
      code: 'REVIEW_MEDIA_OBJECT_NOT_FOUND',
    });
  }
}

export class ReviewMediaLimitException extends UnprocessableEntityException {
  constructor(message: string) {
    super({ message, code: 'REVIEW_MEDIA_LIMIT_EXCEEDED' });
  }
}

export class ReviewHelpfulSelfVoteException extends UnprocessableEntityException {
  constructor() {
    super({
      message: 'You cannot vote on your own review.',
      code: 'REVIEW_HELPFUL_SELF_VOTE',
    });
  }
}

export class ReviewHelpfulNotPublishedException extends UnprocessableEntityException {
  constructor() {
    super({
      message: 'Only published reviews accept helpful votes.',
      code: 'REVIEW_HELPFUL_NOT_PUBLISHED',
    });
  }
}

export class ReviewPendingRevisionExistsException extends ConflictException {
  constructor() {
    super({
      message: 'A pending revision already exists for this review.',
      code: 'REVIEW_PENDING_REVISION_EXISTS',
    });
  }
}

export class ReviewInvalidTransitionException extends UnprocessableEntityException {
  constructor() {
    super({
      message: 'This moderation action is not allowed for the current review state.',
      code: 'REVIEW_INVALID_TRANSITION',
    });
  }
}
