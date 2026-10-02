import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';
import { ProductRepository } from '../../product.repository';
import { CreateAttributeDefinitionDto } from '../dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from '../dto/update-attribute-definition.dto';
import { GetAttributeDefinitionsQueryDto } from '../dto/get-attribute-definitions-query.dto';
import { AttributeDefinitionResponseDto } from '../dto/attribute-definition-response.dto';
import { AttributeMapper } from '../mappers/attribute.mapper';
import {
  AttributeDefinitionAlreadyExistsException,
  AttributeDefinitionImmutableException,
  AttributeDefinitionInUseException,
  AttributeDefinitionNotFoundException,
} from '@/common/exceptions/attribute.exception';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';
import { PaginatedResult } from '@/common/types/api-response.types';

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

    const def = await this.attributeDefinitionRepository.create({
      name: dto.name.trim(),
      type: dto.type,
      scope: dto.scope,
      unit: dto.unit?.trim() ?? null,
      isFilterable: dto.isFilterable ?? false,
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

    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.attributeDefinitionRepository.findByName(
        dto.name,
        existing.productId,
      );
      if (duplicate && duplicate.id !== id) {
        throw new AttributeDefinitionAlreadyExistsException();
      }
    }

    const updated = await this.attributeDefinitionRepository.update(id, {
      ...(dto.name && { name: dto.name.trim() }),
      ...(dto.unit !== undefined && { unit: dto.unit?.trim() ?? null }),
      ...(dto.isFilterable !== undefined && { isFilterable: dto.isFilterable }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.scope !== undefined && { scope: dto.scope }),
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
}
