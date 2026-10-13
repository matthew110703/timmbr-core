import { BadRequestException } from '@nestjs/common';

export class InvalidListingFiltersException extends BadRequestException {
  constructor(reason: string) {
    super({ message: `Invalid filters: ${reason}`, code: 'LISTING_FILTERS_INVALID' });
  }
}
