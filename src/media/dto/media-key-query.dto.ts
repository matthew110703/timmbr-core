import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MediaKeyQueryDto {
  @IsString({ message: 'Key must be a string' })
  @IsNotEmpty({ message: 'Key is required' })
  @MaxLength(500, { message: 'Key cannot exceed 500 characters' })
  key!: string;
}
