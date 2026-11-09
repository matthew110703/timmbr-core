import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { PresignedUrlItemDto } from '@/media/dto/generate-presigned-url.dto';

export class PresignReviewMediaDto {
  @IsArray({ message: 'Files must be an array.' })
  @ArrayMinSize(1, { message: 'At least one file is required.' })
  @ArrayMaxSize(5, { message: 'At most 5 files per presign request.' })
  @ValidateNested({ each: true })
  @Type(() => PresignedUrlItemDto)
  files!: PresignedUrlItemDto[];
}
