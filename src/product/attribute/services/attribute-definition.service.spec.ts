import { Test, TestingModule } from '@nestjs/testing';
import { AttributeScope, AttributeType } from '@prisma/client';
import { AttributeDefinitionService } from './attribute-definition.service';
import { AttributeDefinitionRepository } from '../repositories/attribute-definition.repository';
import { ProductRepository } from '../../product.repository';
import {
  AttributeDefinitionAlreadyExistsException,
  AttributeDefinitionImmutableException,
  AttributeDefinitionInUseException,
  AttributeDefinitionNotFoundException,
} from '@/common/exceptions/attribute.exception';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';

describe('AttributeDefinitionService', () => {
  let service: AttributeDefinitionService;
  let mockAttributeDefinitionRepository: any;
  let mockProductRepository: any;

  const mockDef: any = {
    id: 'def-uuid-1',
    name: 'Color',
    type: AttributeType.STRING,
    scope: AttributeScope.VARIANT,
    unit: null,
    isFilterable: true,
    productId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { values: 0 },
  };

  beforeEach(async () => {
    mockAttributeDefinitionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findPaginated: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countUsage: jest.fn(),
    };

    mockProductRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributeDefinitionService,
        { provide: AttributeDefinitionRepository, useValue: mockAttributeDefinitionRepository },
        { provide: ProductRepository, useValue: mockProductRepository },
      ],
    }).compile();

    service = module.get<AttributeDefinitionService>(AttributeDefinitionService);
  });

  describe('create', () => {
    it('creates a global definition successfully', async () => {
      mockAttributeDefinitionRepository.findByName.mockResolvedValue(null);
      mockAttributeDefinitionRepository.create.mockResolvedValue(mockDef);

      const result = await service.create({
        name: 'Color',
        type: AttributeType.STRING,
        scope: AttributeScope.VARIANT,
        isFilterable: true,
      });

      expect(mockAttributeDefinitionRepository.findByName).toHaveBeenCalledWith('Color', null);
      expect(mockAttributeDefinitionRepository.create).toHaveBeenCalled();
      expect(result.id).toBe('def-uuid-1');
      expect(result.name).toBe('Color');
    });

    it('creates a product-specific definition when product exists', async () => {
      mockProductRepository.findById.mockResolvedValue({ id: 'prod-uuid-1' });
      mockAttributeDefinitionRepository.findByName.mockResolvedValue(null);
      mockAttributeDefinitionRepository.create.mockResolvedValue({
        ...mockDef,
        productId: 'prod-uuid-1',
      });

      const result = await service.create({
        name: 'Custom Fabric',
        type: AttributeType.STRING,
        scope: AttributeScope.PRODUCT,
        productId: 'prod-uuid-1',
      });

      expect(mockProductRepository.findById).toHaveBeenCalledWith('prod-uuid-1');
      expect(result.productId).toBe('prod-uuid-1');
    });

    it('throws ProductNotFoundException when specified productId does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Custom Fabric',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          productId: 'non-existent-product',
        }),
      ).rejects.toThrow(ProductNotFoundException);
    });

    it('throws AttributeDefinitionAlreadyExistsException when name is duplicate', async () => {
      mockAttributeDefinitionRepository.findByName.mockResolvedValue(mockDef);

      await expect(
        service.create({
          name: 'Color',
          type: AttributeType.STRING,
          scope: AttributeScope.VARIANT,
        }),
      ).rejects.toThrow(AttributeDefinitionAlreadyExistsException);
    });
  });

  describe('getAll', () => {
    it('returns paginated definitions with usage count and meta', async () => {
      mockAttributeDefinitionRepository.findPaginated.mockResolvedValue([[mockDef], 1]);

      const result = await service.getAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].usageCount).toBe(0);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getById', () => {
    it('returns definition when found', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockDef);

      const result = await service.getById('def-uuid-1');
      expect(result.id).toBe('def-uuid-1');
    });

    it('throws AttributeDefinitionNotFoundException when not found', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(null);

      await expect(service.getById('def-uuid-none')).rejects.toThrow(
        AttributeDefinitionNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates definition fields successfully when not in use', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockDef);
      mockAttributeDefinitionRepository.countUsage.mockResolvedValue(0);
      mockAttributeDefinitionRepository.update.mockResolvedValue({
        ...mockDef,
        name: 'Colour',
      });

      const result = await service.update('def-uuid-1', { name: 'Colour' });
      expect(result.name).toBe('Colour');
    });

    it('throws AttributeDefinitionImmutableException when attempting to change type of in-use definition', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockDef);
      mockAttributeDefinitionRepository.countUsage.mockResolvedValue(5);

      await expect(service.update('def-uuid-1', { type: AttributeType.INTEGER })).rejects.toThrow(
        AttributeDefinitionImmutableException,
      );
    });

    it('throws AttributeDefinitionImmutableException when attempting to change scope of in-use definition', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockDef);
      mockAttributeDefinitionRepository.countUsage.mockResolvedValue(3);

      await expect(service.update('def-uuid-1', { scope: AttributeScope.PRODUCT })).rejects.toThrow(
        AttributeDefinitionImmutableException,
      );
    });

    it('throws AttributeDefinitionAlreadyExistsException if updated name conflicts', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockDef);
      mockAttributeDefinitionRepository.countUsage.mockResolvedValue(0);
      mockAttributeDefinitionRepository.findByName.mockResolvedValue({
        id: 'def-uuid-2',
        name: 'ExistingName',
      });

      await expect(service.update('def-uuid-1', { name: 'ExistingName' })).rejects.toThrow(
        AttributeDefinitionAlreadyExistsException,
      );
    });
  });

  describe('delete', () => {
    it('deletes definition when usageCount is 0', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockDef);
      mockAttributeDefinitionRepository.countUsage.mockResolvedValue(0);
      mockAttributeDefinitionRepository.delete.mockResolvedValue(undefined);

      await expect(service.delete('def-uuid-1')).resolves.toBeUndefined();
      expect(mockAttributeDefinitionRepository.delete).toHaveBeenCalledWith('def-uuid-1');
    });

    it('throws AttributeDefinitionInUseException when definition has assigned values', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(mockDef);
      mockAttributeDefinitionRepository.countUsage.mockResolvedValue(4);

      await expect(service.delete('def-uuid-1')).rejects.toThrow(AttributeDefinitionInUseException);
    });

    it('throws AttributeDefinitionNotFoundException when definition does not exist', async () => {
      mockAttributeDefinitionRepository.findById.mockResolvedValue(null);

      await expect(service.delete('def-uuid-none')).rejects.toThrow(
        AttributeDefinitionNotFoundException,
      );
    });
  });
});
