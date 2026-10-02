import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignAttributeValueDto {
  @IsUUID()
  @IsNotEmpty()
  definitionId!: string;

  @IsNotEmpty()
  value!: unknown;
}
