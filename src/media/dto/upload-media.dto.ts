import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UploadMediaDto {
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
}
