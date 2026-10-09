import {
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class GeocodingUnavailableException extends ServiceUnavailableException {
  constructor(
    message = 'Location lookup is unavailable right now. Please enter the address manually.',
  ) {
    super({ message, code: 'GEOCODING_UNAVAILABLE' });
  }
}

export class LocationNotFoundException extends NotFoundException {
  constructor(message = 'No address was found for this location.') {
    super({ message, code: 'LOCATION_NOT_FOUND' });
  }
}

export class LocationOutsideServiceAreaException extends UnprocessableEntityException {
  constructor(message = 'We currently deliver only within India.') {
    super({ message, code: 'LOCATION_OUTSIDE_INDIA' });
  }
}
