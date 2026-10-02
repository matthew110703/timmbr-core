import { Test, TestingModule } from '@nestjs/testing';
import { ProductAttributeAdminController } from './product-attribute.admin.controller';
import { AttributeValueService } from '../services/attribute-value.service';
import { AttributeScope, AttributeType } from '@prisma/client';

describe('ProductAttributeAdminController', () => {
  let controller: ProductAttributeAdminController;
  let mockService: any;

  const mockValueResponse: any = {
    id: 'val-uuid-1',
    definition: {
      id: 'def-prod-1',
      name: 'Material',
      type: AttributeType.STRING,
      scope: AttributeScope.PRODUCT,
      unit: null,
      isFilterable: false,
    },
    value: 'Velvet',
  };

  beforeEach(async () => {
    mockService = {
      getProductAttributes: jest.fn(),
      assignProductAttribute: jest.fn(),
      removeProductAttribute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductAttributeAdminController],
      providers: [{ provide: AttributeValueService, useValue: mockService }],
    }).compile();

    controller = module.get<ProductAttributeAdminController>(ProductAttributeAdminController);
  });

  it('delegates getAttributes to service', async () => {
    mockService.getProductAttributes.mockResolvedValue([mockValueResponse]);
    const result = await controller.getAttributes('prod-uuid-1');
    expect(mockService.getProductAttributes).toHaveBeenCalledWith('prod-uuid-1');
    expect(result).toHaveLength(1);
  });

  it('delegates assignAttribute to service', async () => {
    mockService.assignProductAttribute.mockResolvedValue(mockValueResponse);
    const dto = { definitionId: 'def-prod-1', value: 'Velvet' };
    const result = await controller.assignAttribute('prod-uuid-1', dto);
    expect(mockService.assignProductAttribute).toHaveBeenCalledWith('prod-uuid-1', dto);
    expect(result).toBe(mockValueResponse);
  });

  it('delegates removeAttribute to service', async () => {
    mockService.removeProductAttribute.mockResolvedValue(undefined);
    await controller.removeAttribute('prod-uuid-1', 'def-prod-1');
    expect(mockService.removeProductAttribute).toHaveBeenCalledWith('prod-uuid-1', 'def-prod-1');
  });
});
