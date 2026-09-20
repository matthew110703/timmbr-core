import { IsOptional, IsString } from 'class-validator';

export class GetPageQueryDto {
  @IsString({ message: 'Section must be a string' })
  @IsOptional()
  section?: string;
}
