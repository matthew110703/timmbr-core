import { Injectable } from '@nestjs/common';
import { AttributeScope, AttributeType, Prisma } from '@prisma/client';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';
import { ProductRepository } from '../../product.repository';
import { CreateAttributeDefinitionDto } from '../dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from '../dto/update-attribute-definition.dto';
import { GetAttributeDefinitionsQueryDto } from '../dto/get-attribute-definitions-query.dto';
import { AttributeDefinitionResponseDto } from '../dto/attribute-definition-response.dto';
import { AttributeMapper } from '../mappers/attribute.mapper';
import { BOOLEAN_TRUE_OPTION, RESERVED_FILTER_KEYS } from '../attribute.constants';
import {
  AttributeDefinitionAlreadyExistsException,
  AttributeDefinitionImmutableException,
  AttributeDefinitionInUseException,
  AttributeDefinitionNotFoundException,
  AttributeFilterRuleException,
  AttributeKeyAlreadyExistsException,
  AttributeKeyImmutableException,
} from '@/common/exceptions/attribute.exception';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';
import { PaginatedResult } from '@/common/types/api-response.types';

/** Types a storefront filter can be built from (each value maps to options). */
const FILTERABLE_TYPES: ReadonlySet<AttributeType> = new Set([
  AttributeType.STRING,
  AttributeType.LIST,
  AttributeType.BOOLEAN,
]);

/** The fields the filter rules look at, after a create or update is applied. */
interface FilterRuleInput {
  id?: string;
  productId: string | null;
  type: AttributeType;
  scope: AttributeScope;
  isFilterable: boolean;
  key: string | null;
}

@Injectable()
export class AttributeDefinitionService {
  constructor(
    private readonly attributeDefinitionRepository: AttributeDefinitionRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async create(dto: CreateAttributeDefinitionDto): Promise<AttributeDefinitionResponseDto> {
    if (dto.productId) {
      const product = await this.productRepository.findById(dto.productId);
      if (!product) {
        throw new ProductNotFoundException();
      }
    }

    const existing = await this.attributeDefinitionRepository.findByName(
      dto.name,
      dto.productId ?? null,
    );
    if (existing) {
      throw new AttributeDefinitionAlreadyExistsException(
        dto.productId
          ? `An attribute definition with name "${dto.name}" already exists for this product.`
          : `A global attribute definition with name "${dto.name}" already exists.`,
      );
    }

    await this.assertFilterRules({
      productId: dto.productId ?? null,
      type: dto.type,
      scope: dto.scope,
      isFilterable: dto.isFilterable ?? false,
      key: dto.key ?? null,
    });

    const def = await this.attributeDefinitionRepository.create({
      name: dto.name.trim(),
      type: dto.type,
      scope: dto.scope,
      unit: dto.unit?.trim() ?? null,
      isFilterable: dto.isFilterable ?? false,
      key: dto.key ?? null,
      ...(dto.displayType && { displayType: dto.displayType }),
      ...(dto.filterOrder !== undefined && { filterOrder: dto.filterOrder }),
      // A global yes/no attribute has exactly one option: "true" selects it.
      ...(dto.type === AttributeType.BOOLEAN &&
        !dto.productId && { options: { create: { ...BOOLEAN_TRUE_OPTION } } }),
      ...(dto.productId && {
        product: {
          connect: { id: dto.productId },
        },
      }),
    });

    return AttributeMapper.toDefinitionResponse(def);
  }

  async getAll(
    query: GetAttributeDefinitionsQueryDto,
  ): Promise<PaginatedResult<AttributeDefinitionResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AttributeDefinitionWhereInput = {
      ...(query.scope && { scope: query.scope }),
      ...(query.type && { type: query.type }),
      ...(query.isFilterable !== undefined && { isFilterable: query.isFilterable }),
      ...(query.productId !== undefined && {
        productId: query.productId ? query.productId : null,
      }),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
    };

    const [defs, total] = await this.attributeDefinitionRepository.findPaginated(
      where,
      page,
      limit,
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: defs.map((d) => AttributeMapper.toDefinitionResponse(d)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getById(id: string): Promise<AttributeDefinitionResponseDto> {
    const def = await this.attributeDefinitionRepository.findById(id);
    if (!def) {
      throw new AttributeDefinitionNotFoundException();
    }
    return AttributeMapper.toDefinitionResponse(def);
  }

  async update(
    id: string,
    dto: UpdateAttributeDefinitionDto,
  ): Promise<AttributeDefinitionResponseDto> {
    const existing = await this.attributeDefinitionRepository.findById(id);
    if (!existing) {
      throw new AttributeDefinitionNotFoundException();
    }

    const usageCount = await this.attributeDefinitionRepository.countUsage(id);

    if (usageCount > 0) {
      if (dto.type !== undefined && dto.type !== existing.type) {
        throw new AttributeDefinitionImmutableException('type');
      }
      if (dto.scope !== undefined && dto.scope !== existing.scope) {
        throw new AttributeDefinitionImmutableException('scope');
      }
    }

    // Storefront URLs use the key (?material=teak): it can be set once, never changed.
    if (dto.key !== undefined && existing.key !== null && dto.key !== existing.key) {
      throw new AttributeKeyImmutableException();
    }

    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.attributeDefinitionRepository.findByName(
        dto.name,
        existing.productId,
      );
      if (duplicate && duplicate.id !== id) {
        throw new AttributeDefinitionAlreadyExistsException();
      }
    }

    await this.assertFilterRules({
      id,
      productId: existing.productId,
      type: dto.type ?? existing.type,
      scope: dto.scope ?? existing.scope,
      isFilterable: dto.isFilterable ?? existing.isFilterable,
      key: dto.key ?? existing.key,
    });

    const updated = await this.attributeDefinitionRepository.update(id, {
      ...(dto.name && { name: dto.name.trim() }),
      ...(dto.unit !== undefined && { unit: dto.unit?.trim() ?? null }),
      ...(dto.isFilterable !== undefined && { isFilterable: dto.isFilterable }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.scope !== undefined && { scope: dto.scope }),
      ...(dto.key !== undefined && { key: dto.key }),
      ...(dto.displayType !== undefined && { displayType: dto.displayType }),
      ...(dto.filterOrder !== undefined && { filterOrder: dto.filterOrder }),
    });

    return AttributeMapper.toDefinitionResponse(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.attributeDefinitionRepository.findById(id);
    if (!existing) {
      throw new AttributeDefinitionNotFoundException();
    }

    const usageCount = await this.attributeDefinitionRepository.countUsage(id);
    if (usageCount > 0) {
      throw new AttributeDefinitionInUseException(usageCount);
    }

    await this.attributeDefinitionRepository.delete(id);
  }

  /**
   * Rules for attributes that become storefront filters:
   * - only global attributes (shared across products) with a URL key can filter;
   * - the key is unique and never one of the listing's own query keys;
   * - the type must map to options (STRING, LIST or BOOLEAN);
   * - at most one VARIANT-scope filter. Variant options are merged per product, so two variant
   *   filters could match a product on two different variants (walnut on one, king on another).
   */
  private async assertFilterRules(def: FilterRuleInput): Promise<void> {
    if (def.key !== null) {
      if (def.productId !== null) {
        throw new AttributeFilterRuleException(
          'Only global attributes can have a filter key; product-specific ones never filter.',
        );
      }
      if (RESERVED_FILTER_KEYS.has(def.key)) {
        throw new AttributeFilterRuleException(
          `"${def.key}" is reserved by the storefront listing and cannot be a filter key.`,
        );
      }
      const taken = await this.attributeDefinitionRepository.findGlobalByKey(def.key);
      if (taken && taken.id !== def.id) {
        throw new AttributeKeyAlreadyExistsException(def.key);
      }
    }

    if (!def.isFilterable) return;

    if (def.productId !== null) {
      throw new AttributeFilterRuleException(
        'Only global attributes can be filterable; product-specific ones stay as specifications.',
      );
    }
    if (def.key === null) {
      throw new AttributeFilterRuleException('A filterable attribute needs a filter key.');
    }
    if (!FILTERABLE_TYPES.has(def.type)) {
      throw new AttributeFilterRuleException(
        `Attributes of type ${def.type} cannot be filters; use STRING, LIST or BOOLEAN.`,
      );
    }
    if (def.scope === AttributeScope.VARIANT) {
      const others = await this.attributeDefinitionRepository.countFilterableVariantScoped(def.id);
      if (others > 0) {
        throw new AttributeFilterRuleException(
          'Only one variant-level attribute can be a filter at a time.',
        );
      }
    }
  }
}
