import { Injectable } from '@nestjs/common';
import { AttributeDefinition, AttributeScope, AttributeType, Prisma } from '@prisma/client';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';
import { AttributeValueRepository } from '../repositories/attribute-value.repository';
import { AttributeOptionRepository } from '../repositories/attribute-option.repository';
import { ProductRepository } from '../../product.repository';
import { VariantRepository } from '../../variant/variant.repository';
import { AssignAttributeValueDto } from '../dto/assign-attribute-value.dto';
import { AttributeValueResponseDto } from '../dto/attribute-value-response.dto';
import { AttributeMapper } from '../mappers/attribute.mapper';
import { AttributeValueValidator } from '../validators/attribute-value.validator';
import {
  AttributeDefinitionNotFoundException,
  AttributeOptionNotFoundException,
  AttributeOwnershipMismatchException,
  AttributeScopeMismatchException,
  AttributeValueAlreadyAssignedException,
  AttributeValueNotFoundException,
  VariantDoesNotBelongToProductException,
} from '@/common/exceptions/attribute.exception';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';
import { VariantNotFoundException } from '@/common/exceptions/variant.exception';
import { FilterableAttributeMetadata } from '../types/attribute.types';

import { ProductCacheService } from '../../cache/product-cache.service';
import { BOOLEAN_TRUE_OPTION } from '../attribute.constants';
import { generateSlug } from '@/common/utils/helpers';

@Injectable()
export class AttributeValueService {
  constructor(
    private readonly attributeValueRepository: AttributeValueRepository,
    private readonly attributeDefinitionRepository: AttributeDefinitionRepository,
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: VariantRepository,
    private readonly cacheService: ProductCacheService,
    private readonly optionRepository: AttributeOptionRepository,
  ) {}

  async assignProductAttribute(
    productId: string,
    dto: AssignAttributeValueDto,
  ): Promise<AttributeValueResponseDto> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const definition = await this.attributeDefinitionRepository.findById(dto.definitionId);
    if (!definition) {
      throw new AttributeDefinitionNotFoundException();
    }

    if (definition.scope !== AttributeScope.PRODUCT) {
      throw new AttributeScopeMismatchException(definition.scope, 'product');
    }

    if (definition.productId !== null && definition.productId !== productId) {
      throw new AttributeOwnershipMismatchException();
    }

    const { value, options } = await this.toStoredValue(definition, dto.value);

    const existing = await this.attributeValueRepository.findByProductAndDefinition(
      productId,
      dto.definitionId,
    );
    if (existing) {
      throw new AttributeValueAlreadyAssignedException('Product');
    }

    // The value and its option links are one nested write: atomic.
    const created = await this.attributeValueRepository.create({
      value,
      ...options,
      definition: {
        connect: { id: dto.definitionId },
      },
      product: {
        connect: { id: productId },
      },
    });

    this.cacheService.invalidate(productId, product.slug);

    return AttributeMapper.toValueResponse(created, true);
  }

  async getProductAttributes(productId: string): Promise<AttributeValueResponseDto[]> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const values = await this.attributeValueRepository.findProductAttributes(productId);
    return values.map((val) => AttributeMapper.toValueResponse(val, false));
  }

  async removeProductAttribute(productId: string, definitionId: string): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const existing = await this.attributeValueRepository.findByProductAndDefinition(
      productId,
      definitionId,
    );
    if (!existing) {
      throw new AttributeValueNotFoundException();
    }

    await this.attributeValueRepository.delete(existing.id);
    this.cacheService.invalidate(productId, product.slug);
  }

  async assignVariantAttribute(
    productId: string,
    variantId: string,
    dto: AssignAttributeValueDto,
  ): Promise<AttributeValueResponseDto> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const variant = await this.variantRepository.findById(variantId);
    if (!variant) {
      throw new VariantNotFoundException();
    }

    if (variant.productId !== productId) {
      throw new VariantDoesNotBelongToProductException();
    }

    const definition = await this.attributeDefinitionRepository.findById(dto.definitionId);
    if (!definition) {
      throw new AttributeDefinitionNotFoundException();
    }

    if (definition.scope !== AttributeScope.VARIANT) {
      throw new AttributeScopeMismatchException(definition.scope, 'variant');
    }

    if (definition.productId !== null && definition.productId !== productId) {
      throw new AttributeOwnershipMismatchException();
    }

    const { value, options } = await this.toStoredValue(definition, dto.value);

    const existing = await this.attributeValueRepository.findByVariantAndDefinition(
      variantId,
      dto.definitionId,
    );
    if (existing) {
      throw new AttributeValueAlreadyAssignedException('Variant');
    }

    const created = await this.attributeValueRepository.create({
      value,
      ...options,
      definition: {
        connect: { id: dto.definitionId },
      },
      variant: {
        connect: { id: variantId },
      },
    });

    this.cacheService.invalidate(productId, product.slug);

    return AttributeMapper.toValueResponse(created, true);
  }

  async getVariantAttributes(
    productId: string,
    variantId: string,
  ): Promise<AttributeValueResponseDto[]> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const variant = await this.variantRepository.findById(variantId);
    if (!variant) {
      throw new VariantNotFoundException();
    }

    if (variant.productId !== productId) {
      throw new VariantDoesNotBelongToProductException();
    }

    const values = await this.attributeValueRepository.findVariantAttributes(variantId);
    return values.map((val) => AttributeMapper.toValueResponse(val, false));
  }

  async removeVariantAttribute(
    productId: string,
    variantId: string,
    definitionId: string,
  ): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const variant = await this.variantRepository.findById(variantId);
    if (!variant) {
      throw new VariantNotFoundException();
    }

    if (variant.productId !== productId) {
      throw new VariantDoesNotBelongToProductException();
    }

    const existing = await this.attributeValueRepository.findByVariantAndDefinition(
      variantId,
      definitionId,
    );
    if (!existing) {
      throw new AttributeValueNotFoundException();
    }

    await this.attributeValueRepository.delete(existing.id);
    this.cacheService.invalidate(productId, product.slug);
  }

  /**
   * Validates a raw value and, for a global attribute that has options (every filterable one
   * does), resolves it to those options by slug or label. Unknown values are rejected so filters
   * only ever see the shared vocabulary; the stored text uses the canonical option labels.
   */
  private async toStoredValue(
    definition: AttributeDefinition,
    raw: unknown,
  ): Promise<{ value: string; options: Pick<Prisma.AttributeValueCreateInput, 'options'> }> {
    const serialized = AttributeValueValidator.validateAndSerialize(definition.type, raw);
    if (definition.productId !== null) {
      return { value: serialized, options: {} };
    }

    const available = await this.optionRepository.findByDefinition(definition.id);
    if (available.length === 0 && !definition.isFilterable) {
      return { value: serialized, options: {} };
    }

    let requested: string[];
    if (definition.type === AttributeType.BOOLEAN) {
      requested = serialized === 'true' ? [BOOLEAN_TRUE_OPTION.slug] : [];
    } else if (definition.type === AttributeType.LIST) {
      requested = JSON.parse(serialized) as string[];
    } else if (definition.type === AttributeType.STRING) {
      requested = [serialized];
    } else {
      return { value: serialized, options: {} };
    }

    const matched = requested.map((input) => {
      const slug = generateSlug(input);
      const lower = input.toLowerCase();
      const option = available.find(
        (o) => o.slug === input || o.slug === slug || o.label.toLowerCase() === lower,
      );
      if (!option) {
        throw new AttributeOptionNotFoundException(input);
      }
      return option;
    });
    const unique = [...new Map(matched.map((o) => [o.id, o])).values()];

    const value =
      definition.type === AttributeType.LIST
        ? JSON.stringify(unique.map((o) => o.label))
        : definition.type === AttributeType.STRING
          ? unique[0].label
          : serialized;

    return {
      value,
      options:
        unique.length > 0
          ? { options: { create: unique.map((o) => ({ option: { connect: { id: o.id } } })) } }
          : {},
    };
  }

  async getFilterMetadata(): Promise<FilterableAttributeMetadata[]> {
    return this.attributeValueRepository.getFilterableMetadata();
  }
}
