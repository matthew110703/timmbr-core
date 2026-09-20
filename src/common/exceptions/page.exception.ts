import { ConflictException, NotFoundException } from '@nestjs/common';

export class PageNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Page not found.', code: 'PAGE_NOT_FOUND' });
  }
}

export class PageAlreadyExistsException extends ConflictException {
  constructor() {
    super({ message: 'A page with this slug already exists.', code: 'PAGE_ALREADY_EXISTS' });
  }
}

export class PageSectionNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Page section not found.', code: 'PAGE_SECTION_NOT_FOUND' });
  }
}
