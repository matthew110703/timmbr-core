import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MEDIA_CONSTANTS } from '../common/media.constants';

export class PresignedUrlItemDto {
  @IsString({ message: 'File name must be a string' })
  @MaxLength(255, { message: 'File name cannot exceed 255 characters' })
  fileName!: string;

  @IsString({ message: 'MIME type must be a string' })
  mimeType!: string;

  @IsNumber({}, { message: 'File size must be a number in bytes' })
  @Min(1, { message: 'File size must be greater than 0 bytes' })
  @IsOptional()
  sizeBytes?: number;
}

export class GeneratePresignedUrlsDto {
  @IsString({ message: 'Folder must be a string' })
  @MaxLength(100, { message: 'Folder prefix cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9_\-/]+$/, {
    message:
      'Folder can only contain alphanumeric characters, hyphens, underscores, and forward slashes',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/^\/+|\/+$/g, '').trim() : value,
  )
  @IsOptional()
  folder?: string;

  @IsArray({ message: 'Files must be an array' })
  @ArrayMinSize(1, { message: 'At least one file must be provided' })
  @ArrayMaxSize(MEDIA_CONSTANTS.MAX_BATCH_UPLOAD_LIMIT, {
    message: `Cannot request more than ${MEDIA_CONSTANTS.MAX_BATCH_UPLOAD_LIMIT} presigned URLs at once`,
  })
  @ValidateNested({ each: true })
  @Type(() => PresignedUrlItemDto)
  files!: PresignedUrlItemDto[];
}
