export class AttributeOptionResponseDto {
  id!: string;
  definitionId!: string;
  label!: string;
  slug!: string;
  swatchHex!: string | null;
  sortOrder!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
