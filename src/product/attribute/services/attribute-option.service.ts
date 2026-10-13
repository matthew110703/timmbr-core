import { Injectable } from '@nestjs/common';
import { AttributeDefinition, AttributeOption, AttributeType, Prisma } from '@prisma/client';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';
import { AttributeOptionRepository } from '../repositories/attribute-option.repository';
import { CreateAttributeOptionDto } from '../dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from '../dto/update-attribute-option.dto';
import { AttributeOptionResponseDto } from '../dto/attribute-option-response.dto';
import { AttributeMapper } from '../mappers/attribute.mapper';
import { FILTER_SLUG_PATTERN } from '../attribute.constants';
import {
  AttributeDefinitionNotFoundException,
  AttributeOptionAlreadyExistsException,
  AttributeOptionInUseException,
  AttributeOptionNotFoundException,
  AttributeOptionsNotSupportedException,
} from '@/common/exceptions/attribute.exception';
import { generateSlug } from '@/common/utils/helpers';

/** Types whose values can be a fixed list of options (BOOLEAN gets its single option itself). */
const OPTION_TYPES: ReadonlySet<AttributeType> = new Set([
  AttributeType.STRING,
  AttributeType.LIST,
]);

/**
 * The allowed values of a global attribute. Filterable values point at these options, so the
 * storefront filters on stable ids and the URL uses the immutable slug.
 */
@Injectable()
export class AttributeOptionService {
  constructor(
    private readonly optionRepository: AttributeOptionRepository,
    private readonly definitionRepository: AttributeDefinitionRepository,
  ) {}

  async getAll(definitionId: string): Promise<AttributeOptionResponseDto[]> {
    await this.findDefinition(definitionId);
    const options = await this.optionRepository.findByDefinition(definitionId);
    return options.map((option) => AttributeMapper.toOptionResponse(option));
  }

  async create(
    definitionId: string,
    dto: CreateAttributeOptionDto,
  ): Promise<AttributeOptionResponseDto> {
    const definition = await this.findDefinition(definitionId);
    this.assertSupportsOptions(definition);

    const label = dto.label.trim();
    const slug = dto.slug ?? generateSlug(label);
    if (!FILTER_SLUG_PATTERN.test(slug)) {
      throw new AttributeOptionsNotSupportedException(
        `Cannot derive a URL slug from "${label}"; pass an explicit slug.`,
      );
    }

    try {
      const option = await this.optionRepository.create({
        definitionId,
        label,
        slug,
        swatchHex: dto.swatchHex?.toUpperCase() ?? null,
        sortOrder: dto.sortOrder ?? 0,
      });
      return AttributeMapper.toOptionResponse(option);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AttributeOptionAlreadyExistsException(slug);
      }
      throw error;
    }
  }

  async update(
    definitionId: string,
    optionId: string,
    dto: UpdateAttributeOptionDto,
  ): Promise<AttributeOptionResponseDto> {
    await this.findOption(definitionId, optionId);
    const option = await this.optionRepository.update(optionId, {
      ...(dto.label !== undefined && { label: dto.label.trim() }),
      ...(dto.swatchHex !== undefined && { swatchHex: dto.swatchHex?.toUpperCase() ?? null }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });
    return AttributeMapper.toOptionResponse(option);
  }

  async delete(definitionId: string, optionId: string): Promise<void> {
    const definition = await this.findDefinition(definitionId);
    const option = await this.findOption(definitionId, optionId);
    if (definition.type === AttributeType.BOOLEAN) {
      throw new AttributeOptionsNotSupportedException(
        'The option of a yes/no attribute is fixed and cannot be deleted.',
      );
    }
    const usage = await this.optionRepository.countUsage(option.id);
    if (usage > 0) {
      throw new AttributeOptionInUseException(usage);
    }
    await this.optionRepository.delete(option.id);
  }

  private async findDefinition(definitionId: string): Promise<AttributeDefinition> {
    const definition = await this.definitionRepository.findById(definitionId);
    if (!definition) {
      throw new AttributeDefinitionNotFoundException();
    }
    return definition;
  }

  private async findOption(definitionId: string, optionId: string): Promise<AttributeOption> {
    const option = await this.optionRepository.findById(optionId);
    if (!option || option.definitionId !== definitionId) {
      throw new AttributeOptionNotFoundException();
    }
    return option;
  }

  private assertSupportsOptions(definition: AttributeDefinition): void {
    if (definition.productId !== null) {
      throw new AttributeOptionsNotSupportedException(
        'Only global attributes can have options; product-specific ones stay free text.',
      );
    }
    if (!OPTION_TYPES.has(definition.type)) {
      throw new AttributeOptionsNotSupportedException(
        definition.type === AttributeType.BOOLEAN
          ? 'Yes/no attributes have a fixed option.'
          : `Attributes of type ${definition.type} cannot have options.`,
      );
    }
  }
}
