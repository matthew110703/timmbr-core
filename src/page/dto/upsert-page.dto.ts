import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsSectionArray, SectionItemPayload } from './section-item.dto';

export class UpsertPageDto {
  @IsString({ message: 'Title must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Title cannot be empty' })
  @IsOptional()
  title?: string;

  @IsString({ message: 'Description must be a string' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  description?: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;

  @IsArray({ message: 'Sections must be an array' })
  @IsSectionArray({
    message: 'Each section must be an object with a non-empty string "type"',
  })
  @Type(() => Object)
  @IsOptional()
  sections?: SectionItemPayload[];
}
