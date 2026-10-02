import { Test, TestingModule } from '@nestjs/testing';
import { AttributeScope, AttributeType } from '@prisma/client';
import { AttributeValueService } from './attribute-value.service';
import { AttributeValueRepository } from '../repositories/attribute-value.repository';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';
import { ProductRepository } from '../../product.repository';
import { VariantRepository } from '../../variant/variant.repository';
import { ProductCacheService } from '../../cache/product-cache.service';
import {
  AttributeDefinitionNotFoundException,
  AttributeOwnershipMismatchException,
  AttributeScopeMismatchException,
  AttributeValueAlreadyAssignedException,
  AttributeValueNotFoundException,
  InvalidAttributeValueTypeException,
  VariantDoesNotBelongToProductException,
} from '@/common/exceptions/attribute.exception';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';

describe('AttributeValueService', () => {
  let service: AttributeValueService;
  let mockAttributeValueRepository: any;
  let mockAttributeDefinitionRepository: any;
  let mockProductRepository: any;
  let mockVariantRepository: any;

  const mockProductDef: any = {
    id: 'def-prod-1',
    name: 'Material',
    type: AttributeType.STRING,
    scope: AttributeScope.PRODUCT,
    unit: null,
    isFilterable: true,
    productId: null,
  };

  const mockVariantDef: any = {
    id: 'def-var-1',
    name: 'Color',
    type: AttributeType.STRING,
    scope: AttributeScope.VARIANT,
    unit: null,
    isFilterable: true,
    productId: null,
  };

  const mockValueRecord: any = {
    id: 'val-uuid-1',
    definitionId: 'def-prod-1',
    productId: 'prod-uuid-1',
    variantId: null,
    value: 'Velvet',
    definition: mockProductDef,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockAttributeValueRepository = {
      findByProductAndDefinition: jest.fn(),
      findByVariantAndDefinition: jest.fn(),
      findProductAttributes: jest.fn(),
      findVariantAttributes: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      getFilterableMetadata: jest.fn(),
    };

    mockAttributeDefinitionRepository = {
      findById: jest.fn(),
    };

    mockProductRepository = {
      findById: jest.fn(),
    };

    mockVariantRepository = {
      findById: jest.fn(),
    };

    const mockProductCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeValueService,
        { provide: AttributeValueRepository, useValue: mockAttributeValueRepository },
        { provide: AttributeDefinitionRepository, useValue: mockAttributeDefinitionRepository },
        { provide: ProductRepository, useValue: mockProductRepository },
        { provide: VariantRepository, useValue: mockVariantRepository },
        { provide: ProductCacheService, useValue: mockProductCacheService },
      ],
    }).compile();

    service = module.get<AttributeValueService>(AttributeValueService);
  });

  describe('assignProductAttribute', () => {
    it('assigns product-scoped attribute successfully', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockProductDef);
      mockAttributeValueRepository.findByProductAndDefinition.mockResolvedValue(null);
      mockAttributeValueRepository.create.mockResolvedValue(mockValueRecord);

      const result = await service.assignProductAttribute('prod-uuid-1', {
        definitionId: 'def-prod-1',
        value: 'Velvet',
      });

      expect(result.id).toBe('val-uuid-1');
      expect(result.value).toBe('Velvet');
      expect(result.definition.name).toBe('Material');
    });

    it('throws ProductNotFoundException if product does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        service.assignProductAttribute('prod-uuid-none', {
          definitionId: 'def-prod-1',
          value: 'Velvet',
        }),
      ).rejects.toThrow(ProductNotFoundException);
    });

    it('throws AttributeDefinitionNotFoundException if definition does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeDefinitionRepository.findById.mockResolvedValue(null);

      await expect(
        service.assignProductAttribute('prod-uuid-1', {
          definitionId: 'def-none',
          value: 'Velvet',
        }),
      ).rejects.toThrow(AttributeDefinitionNotFoundException);
    });

    it('throws AttributeScopeMismatchException if definition has VARIANT scope', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockVariantDef);

      await expect(
        service.assignProductAttribute('prod-uuid-1', {
          definitionId: 'def-var-1',
          value: 'Black',
        }),
      ).rejects.toThrow(AttributeScopeMismatchException);
    });

    it('throws AttributeOwnershipMismatchException if definition belongs to another product', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeDefinitionRepository.findById.mockResolvedValue({
        ...mockProductDef,
        productId: 'different-product-uuid',
      });

      await expect(
        service.assignProductAttribute('prod-uuid-1', {
          definitionId: 'def-prod-1',
          value: 'Velvet',
        }),
      ).rejects.toThrow(AttributeOwnershipMismatchException);
    });

    it('throws InvalidAttributeValueTypeException if value does not match type', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeDefinitionRepository.findById.mockResolvedValue({
        ...mockProductDef,
        type: AttributeType.INTEGER,
      });

      await expect(
        service.assignProductAttribute('prod-uuid-1', {
          definitionId: 'def-prod-1',
          value: 'not-an-int',
        }),
      ).rejects.toThrow(InvalidAttributeValueTypeException);
    });

    it('throws AttributeValueAlreadyAssignedException if product already has a value for this definition', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockProductDef);
      mockAttributeValueRepository.findByProductAndDefinition.mockResolvedValue(mockValueRecord);

      await expect(
        service.assignProductAttribute('prod-uuid-1', {
          definitionId: 'def-prod-1',
          value: 'Leather',
        }),
      ).rejects.toThrow(AttributeValueAlreadyAssignedException);
    });
  });

  describe('getProductAttributes', () => {
    it('returns array of assigned product attributes', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeValueRepository.findProductAttributes.mockResolvedValue([mockValueRecord]);

      const result = await service.getProductAttributes('prod-uuid-1');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('Velvet');
    });
  });

  describe('removeProductAttribute', () => {
    it('removes assigned value successfully', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeValueRepository.findByProductAndDefinition.mockResolvedValue(mockValueRecord);
      mockAttributeValueRepository.delete.mockResolvedValue(undefined);

      await expect(
        service.removeProductAttribute('prod-uuid-1', 'def-prod-1'),
      ).resolves.toBeUndefined();
      expect(mockAttributeValueRepository.delete).toHaveBeenCalledWith('val-uuid-1');
    });

    it('throws AttributeValueNotFoundException if assignment not found', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeValueRepository.findByProductAndDefinition.mockResolvedValue(null);

      await expect(service.removeProductAttribute('prod-uuid-1', 'def-none')).rejects.toThrow(
        AttributeValueNotFoundException,
      );
    });
  });

  describe('assignVariantAttribute', () => {
    it('assigns variant-scoped attribute successfully', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockVariantRepository.findById.mockResolvedValue({
        id: 'var-uuid-1',
        productId: 'prod-uuid-1',
      });
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockVariantDef);
      mockAttributeValueRepository.findByVariantAndDefinition.mockResolvedValue(null);
      mockAttributeValueRepository.create.mockResolvedValue({
        ...mockValueRecord,
        definitionId: 'def-var-1',
        productId: null,
        variantId: 'var-uuid-1',
        value: 'Black',
        definition: mockVariantDef,
      });

      const result = await service.assignVariantAttribute('prod-uuid-1', 'var-uuid-1', {
        definitionId: 'def-var-1',
        value: 'Black',
      });

      expect(result.value).toBe('Black');
      expect(result.definition.name).toBe('Color');
    });

    it('throws VariantDoesNotBelongToProductException when variant belongs to a different product', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockVariantRepository.findById.mockResolvedValue({
        id: 'var-uuid-1',
        productId: 'another-product-id',
      });

      await expect(
        service.assignVariantAttribute('prod-uuid-1', 'var-uuid-1', {
          definitionId: 'def-var-1',
          value: 'Black',
        }),
      ).rejects.toThrow(VariantDoesNotBelongToProductException);
    });

    it('throws AttributeScopeMismatchException when assigning PRODUCT scope definition to variant', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockVariantRepository.findById.mockResolvedValue({
        id: 'var-uuid-1',
        productId: 'prod-uuid-1',
      });
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockProductDef);

      await expect(
        service.assignVariantAttribute('prod-uuid-1', 'var-uuid-1', {
          definitionId: 'def-prod-1',
          value: 'Velvet',
        }),
      ).rejects.toThrow(AttributeScopeMismatchException);
    });
  });

  describe('getFilterMetadata', () => {
    it('delegates to repository getFilterableMetadata', async () => {
      mockAttributeValueRepository.getFilterableMetadata.mockResolvedValue([
        { name: 'Color', type: AttributeType.STRING, options: [{ value: 'Black', count: 2 }] },
      ]);

      const result = await service.getFilterMetadata();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Color');
    });
  });
});
