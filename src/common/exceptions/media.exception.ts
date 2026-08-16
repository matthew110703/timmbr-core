import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

export class MediaUnsupportedTypeException extends BadRequestException {
  constructor(mimetype: string) {
    super({
      message: `Unsupported media type: '${mimetype}'. Allowed types are: image/jpeg, image/png, image/webp, image/avif, video/mp4, video/webm.`,
      code: 'MEDIA_UNSUPPORTED_TYPE',
    });
  }
}

export class MediaFileTooLargeException extends BadRequestException {
  constructor(maxSizeMb: number) {
    super({
      message: `File size exceeds the maximum allowed limit of ${maxSizeMb}MB.`,
      code: 'MEDIA_FILE_TOO_LARGE',
    });
  }
}

export class MediaEmptyFileException extends BadRequestException {
  constructor() {
    super({
      message: 'Uploaded file is empty or missing.',
      code: 'MEDIA_EMPTY_FILE',
    });
  }
}

export class MediaMissingConfigException extends InternalServerErrorException {
  constructor(detail?: string) {
    super({
      message: detail
        ? `Storage configuration error: ${detail}`
        : 'Object storage is not properly configured.',
      code: 'MEDIA_STORAGE_NOT_CONFIGURED',
    });
  }
}

export class MediaStorageException extends InternalServerErrorException {
  constructor(message = 'Failed to process media storage operation.') {
    super({
      message,
      code: 'MEDIA_STORAGE_ERROR',
    });
  }
}
