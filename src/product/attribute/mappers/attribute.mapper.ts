import { AttributeDefinition, AttributeValue } from '@prisma/client';
import { AttributeDefinitionResponseDto } from '../dto/attribute-definition-response.dto';
import { AttributeValueResponseDto } from '../dto/attribute-value-response.dto';
import { AttributeValueValidator } from '../validators/attribute-value.validator';
import {
  ProductAttributeSpecification,
  VariantOptionGroup,
  VariantAttributeMap,
} from '../types/attribute.types';

export type AttributeDefinitionWithCount = AttributeDefinition & {
  _count?: {
    values: number;
  };
};

export type AttributeValueWithDefinition = AttributeValue & {
  definition: AttributeDefinition;
};

export class AttributeMapper {
  static toDefinitionResponse(def: AttributeDefinitionWithCount): AttributeDefinitionResponseDto {
    return {
      id: def.id,
      name: def.name,
      type: def.type,
      scope: def.scope,
      unit: def.unit,
      isFilterable: def.isFilterable,
      productId: def.productId,
      usageCount: def._count?.values ?? 0,
      createdAt: def.createdAt,
      updatedAt: def.updatedAt,
    };
  }

  static toValueResponse(
    val: AttributeValueWithDefinition,
    includeTargets = false,
  ): AttributeValueResponseDto {
    return {
      id: val.id,
      definition: {
        id: val.definition.id,
        name: val.definition.name,
        type: val.definition.type,
        scope: val.definition.scope,
        unit: val.definition.unit,
        isFilterable: val.definition.isFilterable,
      },
      value: AttributeValueValidator.deserialize(val.definition.type, val.value),
      ...(includeTargets && {
        productId: val.productId,
        variantId: val.variantId,
        createdAt: val.createdAt,
        updatedAt: val.updatedAt,
      }),
    };
  }

  static toProductSpecification(val: AttributeValueWithDefinition): ProductAttributeSpecification {
    return {
      name: val.definition.name,
      value: AttributeValueValidator.deserialize(val.definition.type, val.value),
      unit: val.definition.unit,
    };
  }

  static toVariantAttributeMap(values: AttributeValueWithDefinition[]): VariantAttributeMap {
    const map: VariantAttributeMap = {};
    for (const val of values) {
      map[val.definition.name] = AttributeValueValidator.deserialize(
        val.definition.type,
        val.value,
      );
    }
    return map;
  }

  static toVariantOptionGroups(
    variantsWithAttributes: { attributeValues?: AttributeValueWithDefinition[] }[],
  ): VariantOptionGroup[] {
    const groupMap = new Map<string, Set<string>>();

    for (const v of variantsWithAttributes) {
      for (const av of v.attributeValues ?? []) {
        const defName = av.definition.name;
        const deserialized = AttributeValueValidator.deserialize(av.definition.type, av.value);
        if (!groupMap.has(defName)) {
          groupMap.set(defName, new Set<string>());
        }
        const set = groupMap.get(defName)!;
        if (Array.isArray(deserialized)) {
          deserialized.forEach((item) => set.add(String(item)));
        } else {
          set.add(String(deserialized));
        }
      }
    }

    const result: VariantOptionGroup[] = [];
    for (const [name, set] of groupMap.entries()) {
      result.push({
        name,
        options: Array.from(set),
      });
    }
    return result;
  }
}
