import { AttributeType } from '@prisma/client';

export type TypedAttributeValue = string | number | string[];

export interface ProductAttributeSpecification {
  name: string;
  value: TypedAttributeValue;
  unit: string | null;
}

export interface VariantOptionGroup {
  name: string;
  options: string[];
}

export type VariantAttributeMap = Record<string, TypedAttributeValue>;

export interface FilterableAttributeOption {
  value: string;
  count: number;
}

export interface FilterableAttributeMetadata {
  name: string;
  type: AttributeType;
  options: FilterableAttributeOption[];
}
