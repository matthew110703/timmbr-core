import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, ProductStatus, VariantStatus } from '@prisma/client';
import { AttributeValueWithDefinition } from '../mappers/attribute.mapper';
import { FilterableAttributeMetadata } from '../types/attribute.types';
import { AttributeValueValidator } from '../validators/attribute-value.validator';

@Injectable()
export class AttributeValueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProductAndDefinition(
    productId: string,
    definitionId: string,
  ): Promise<AttributeValueWithDefinition | null> {
    return this.prisma.attributeValue.findFirst({
      where: {
        productId,
        definitionId,
      },
      include: {
        definition: true,
      },
    });
  }

  async findByVariantAndDefinition(
    variantId: string,
    definitionId: string,
  ): Promise<AttributeValueWithDefinition | null> {
    return this.prisma.attributeValue.findFirst({
      where: {
        variantId,
        definitionId,
      },
      include: {
        definition: true,
      },
    });
  }

  async findProductAttributes(productId: string): Promise<AttributeValueWithDefinition[]> {
    return this.prisma.attributeValue.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      include: {
        definition: true,
      },
    });
  }

  async findVariantAttributes(variantId: string): Promise<AttributeValueWithDefinition[]> {
    return this.prisma.attributeValue.findMany({
      where: { variantId },
      orderBy: { createdAt: 'asc' },
      include: {
        definition: true,
      },
    });
  }

  async create(data: Prisma.AttributeValueCreateInput): Promise<AttributeValueWithDefinition> {
    return this.prisma.attributeValue.create({
      data,
      include: {
        definition: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.attributeValue.delete({
      where: { id },
    });
  }

  async getFilterableMetadata(): Promise<FilterableAttributeMetadata[]> {
    const definitions = await this.prisma.attributeDefinition.findMany({
      where: { isFilterable: true },
      include: {
        values: {
          where: {
            OR: [
              {
                product: {
                  status: ProductStatus.ACTIVE,
                },
              },
              {
                variant: {
                  status: VariantStatus.ACTIVE,
                  product: {
                    status: ProductStatus.ACTIVE,
                  },
                },
              },
            ],
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const results: FilterableAttributeMetadata[] = [];

    for (const def of definitions) {
      const countMap = new Map<string, number>();

      for (const val of def.values) {
        const deserialized = AttributeValueValidator.deserialize(def.type, val.value);
        if (Array.isArray(deserialized)) {
          for (const item of deserialized) {
            const key = String(item);
            countMap.set(key, (countMap.get(key) ?? 0) + 1);
          }
        } else {
          const key = String(deserialized);
          countMap.set(key, (countMap.get(key) ?? 0) + 1);
        }
      }

      const options = Array.from(countMap.entries()).map(([value, count]) => ({
        value,
        count,
      }));

      results.push({
        name: def.name,
        type: def.type,
        options,
      });
    }

    return results;
  }
}
