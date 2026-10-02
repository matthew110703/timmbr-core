import { Test, TestingModule } from '@nestjs/testing';
import { VariantAttributeAdminController } from './variant-attribute.admin.controller';
import { AttributeValueService } from '../services/attribute-value.service';
import { AttributeScope, AttributeType } from '@prisma/client';

describe('VariantAttributeAdminController', () => {
  let controller: VariantAttributeAdminController;
  let mockService: any;

  const mockValueResponse: any = {
    id: 'val-uuid-2',
    definition: {
      id: 'def-var-1',
      name: 'Color',
      type: AttributeType.STRING,
      scope: AttributeScope.VARIANT,
      unit: null,
      isFilterable: true,
    },
    value: 'Emerald Green',
  };

  beforeEach(async () => {
    mockService = {
      getVariantAttributes: jest.fn(),
      assignVariantAttribute: jest.fn(),
      removeVariantAttribute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VariantAttributeAdminController],
      providers: [{ provide: AttributeValueService, useValue: mockService }],
    }).compile();

    controller = module.get<VariantAttributeAdminController>(VariantAttributeAdminController);
  });

  it('delegates getAttributes to service', async () => {
    mockService.getVariantAttributes.mockResolvedValue([mockValueResponse]);
    const result = await controller.getAttributes('prod-uuid-1', 'var-uuid-1');
    expect(mockService.getVariantAttributes).toHaveBeenCalledWith('prod-uuid-1', 'var-uuid-1');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('Emerald Green');
  });

  it('delegates assignAttribute to service', async () => {
    mockService.assignVariantAttribute.mockResolvedValue(mockValueResponse);
    const dto = { definitionId: 'def-var-1', value: 'Emerald Green' };
    const result = await controller.assignAttribute('prod-uuid-1', 'var-uuid-1', dto);
    expect(mockService.assignVariantAttribute).toHaveBeenCalledWith(
      'prod-uuid-1',
      'var-uuid-1',
      dto,
    );
    expect(result).toBe(mockValueResponse);
  });

  it('delegates removeAttribute to service', async () => {
    mockService.removeVariantAttribute.mockResolvedValue(undefined);
    await controller.removeAttribute('prod-uuid-1', 'var-uuid-1', 'def-var-1');
    expect(mockService.removeVariantAttribute).toHaveBeenCalledWith(
      'prod-uuid-1',
      'var-uuid-1',
      'def-var-1',
    );
  });
});
