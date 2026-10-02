import { AttributeScope, AttributeType } from '@prisma/client';
import { TypedAttributeValue } from '../types/attribute.types';

export class AttributeValueDefinitionDto {
  id!: string;
  name!: string;
  type!: AttributeType;
  scope!: AttributeScope;
  unit!: string | null;
  isFilterable!: boolean;
}

export class AttributeValueResponseDto {
  id!: string;
  definition!: AttributeValueDefinitionDto;
  value!: TypedAttributeValue;
  productId?: string | null;
  variantId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
