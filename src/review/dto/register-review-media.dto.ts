import { ReviewMediaKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class RegisterReviewMediaItemDto {
  @IsString({ message: 'Storage key must be a string.' })
  storageKey!: string;

  @IsEnum(ReviewMediaKind, { message: 'Kind must be IMAGE or VIDEO.' })
  kind!: ReviewMediaKind;

  @IsString({ message: 'MIME type must be a string.' })
  mimeType!: string;

  @Type(() => Number)
  @IsInt({ message: 'Size must be an integer.' })
  @Min(1, { message: 'Size must be positive.' })
  sizeBytes!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Sort order must be an integer.' })
  @Min(0, { message: 'Sort order must be non-negative.' })
  sortOrder?: number;

  @IsOptional()
  @IsUUID('4', { message: 'Revision ID must be a valid UUID.' })
  revisionId?: string | null;
}

export class RegisterReviewMediaDto {
  @IsArray({ message: 'Media must be an array.' })
  @ArrayMinSize(1, { message: 'At least one media item is required.' })
  @ValidateNested({ each: true })
  @Type(() => RegisterReviewMediaItemDto)
  media!: RegisterReviewMediaItemDto[];
}

export class ReorderReviewMediaDto {
  @IsArray({ message: 'Media IDs must be an array.' })
  @ArrayMinSize(1, { message: 'At least one media ID is required.' })
  @IsUUID('4', { each: true, message: 'Each media ID must be a valid UUID.' })
  mediaIds!: string[];
}
