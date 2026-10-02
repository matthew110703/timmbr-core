import { Injectable } from '@nestjs/common';
import { AttributeScope } from '@prisma/client';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';
import { AttributeValueRepository } from '../repositories/attribute-value.repository';
import { ProductRepository } from '../../product.repository';
import { VariantRepository } from '../../variant/variant.repository';
import { AssignAttributeValueDto } from '../dto/assign-attribute-value.dto';
import { AttributeValueResponseDto } from '../dto/attribute-value-response.dto';
import { AttributeMapper } from '../mappers/attribute.mapper';
import { AttributeValueValidator } from '../validators/attribute-value.validator';
import {
  AttributeDefinitionNotFoundException,
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

@Injectable()
export class AttributeValueService {
  constructor(
    private readonly attributeValueRepository: AttributeValueRepository,
    private readonly attributeDefinitionRepository: AttributeDefinitionRepository,
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: VariantRepository,
    private readonly cacheService: ProductCacheService,
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

    const serializedValue = AttributeValueValidator.validateAndSerialize(
      definition.type,
      dto.value,
    );

    const existing = await this.attributeValueRepository.findByProductAndDefinition(
      productId,
      dto.definitionId,
    );
    if (existing) {
      throw new AttributeValueAlreadyAssignedException('Product');
    }

    const created = await this.attributeValueRepository.create({
      value: serializedValue,
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

    const serializedValue = AttributeValueValidator.validateAndSerialize(
      definition.type,
      dto.value,
    );

    const existing = await this.attributeValueRepository.findByVariantAndDefinition(
      variantId,
      dto.definitionId,
    );
    if (existing) {
      throw new AttributeValueAlreadyAssignedException('Variant');
    }

    const created = await this.attributeValueRepository.create({
      value: serializedValue,
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

  async getFilterMetadata(): Promise<FilterableAttributeMetadata[]> {
    return this.attributeValueRepository.getFilterableMetadata();
  }
}
