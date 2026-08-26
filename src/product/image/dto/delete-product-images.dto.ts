import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class DeleteProductImagesDto {
  @IsArray({ message: 'imageIds must be an array' })
  @ArrayMinSize(1, { message: 'At least one image ID must be provided' })
  @IsUUID('4', { each: true, message: 'Each image ID must be a valid UUID' })
  imageIds!: string[];
}
