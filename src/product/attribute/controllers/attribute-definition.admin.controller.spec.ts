import { Test, TestingModule } from '@nestjs/testing';
import { AttributeDefinitionAdminController } from './attribute-definition.admin.controller';
import { AttributeDefinitionService } from '../services/attribute-definition.service';
import { AttributeScope, AttributeType } from '@prisma/client';

describe('AttributeDefinitionAdminController', () => {
  let controller: AttributeDefinitionAdminController;
  let mockService: any;

  const mockResponse: any = {
    id: 'def-uuid-1',
    name: 'Color',
    type: AttributeType.STRING,
    scope: AttributeScope.VARIANT,
    unit: null,
    isFilterable: true,
    productId: null,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockService = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttributeDefinitionAdminController],
      providers: [{ provide: AttributeDefinitionService, useValue: mockService }],
    }).compile();

    controller = module.get<AttributeDefinitionAdminController>(AttributeDefinitionAdminController);
  });

  it('delegates getAll to service', async () => {
    mockService.getAll.mockResolvedValue({ data: [mockResponse], meta: {} });
    const result = await controller.getAll({ page: 1, limit: 10 });
    expect(mockService.getAll).toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
  });

  it('delegates getById to service', async () => {
    mockService.getById.mockResolvedValue(mockResponse);
    const result = await controller.getById('def-uuid-1');
    expect(mockService.getById).toHaveBeenCalledWith('def-uuid-1');
    expect(result).toBe(mockResponse);
  });

  it('delegates create to service', async () => {
    mockService.create.mockResolvedValue(mockResponse);
    const dto = {
      name: 'Color',
      type: AttributeType.STRING,
      scope: AttributeScope.VARIANT,
    };
    const result = await controller.create(dto);
    expect(mockService.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(mockResponse);
  });

  it('delegates update to service', async () => {
    mockService.update.mockResolvedValue(mockResponse);
    const dto = { name: 'Colour' };
    const result = await controller.update('def-uuid-1', dto);
    expect(mockService.update).toHaveBeenCalledWith('def-uuid-1', dto);
    expect(result).toBe(mockResponse);
  });

  it('delegates delete to service and returns null', async () => {
    mockService.delete.mockResolvedValue(undefined);
    const result = await controller.delete('def-uuid-1');
    expect(mockService.delete).toHaveBeenCalledWith('def-uuid-1');
    expect(result).toBeNull();
  });
});
