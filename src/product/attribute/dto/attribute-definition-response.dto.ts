import { AttributeScope, AttributeType } from '@prisma/client';

export class AttributeDefinitionResponseDto {
  id!: string;
  name!: string;
  type!: AttributeType;
  scope!: AttributeScope;
  unit!: string | null;
  isFilterable!: boolean;
  productId!: string | null;
  usageCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
