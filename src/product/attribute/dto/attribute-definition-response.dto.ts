import { AttributeScope, AttributeType, FilterDisplay } from '@prisma/client';

export class AttributeDefinitionResponseDto {
  id!: string;
  name!: string;
  type!: AttributeType;
  scope!: AttributeScope;
  unit!: string | null;
  isFilterable!: boolean;
  key!: string | null;
  displayType!: FilterDisplay;
  filterOrder!: number;
  productId!: string | null;
  usageCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
