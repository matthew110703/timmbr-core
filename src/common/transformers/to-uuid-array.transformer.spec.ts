import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetProductsQueryDto } from '@/product/dto/get-products-query.dto';
import { GetCategoriesQueryDto } from '@/category/dto/get-categories-query.dto';
import { GetBrandsQueryDto } from '@/brand/dto/get-brands-query.dto';

describe('ToUuidArray Transformer and DTO Validation', () => {
  const UUID_1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const UUID_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

  describe('GetProductsQueryDto', () => {
    it('transforms comma-separated productIds to an array of UUIDs', async () => {
      const dto = plainToInstance(GetProductsQueryDto, {
        productIds: `${UUID_1}, ${UUID_2}`,
      });

      expect(dto.productIds).toEqual([UUID_1, UUID_2]);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('handles single UUID string', async () => {
      const dto = plainToInstance(GetProductsQueryDto, {
        productIds: UUID_1,
      });

      expect(dto.productIds).toEqual([UUID_1]);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails validation on invalid UUID in productIds', async () => {
      const dto = plainToInstance(GetProductsQueryDto, {
        productIds: `${UUID_1}, not-a-uuid`,
      });

      expect(dto.productIds).toEqual([UUID_1, 'not-a-uuid']);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('productIds');
    });

    it('transforms categoryIds and brandIds comma-separated strings', async () => {
      const dto = plainToInstance(GetProductsQueryDto, {
        categoryIds: `${UUID_1}, ${UUID_2}`,
        brandIds: UUID_1,
      });

      expect(dto.categoryIds).toEqual([UUID_1, UUID_2]);
      expect(dto.brandIds).toEqual([UUID_1]);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('GetCategoriesQueryDto', () => {
    it('transforms comma-separated categoryIds to array', async () => {
      const dto = plainToInstance(GetCategoriesQueryDto, {
        categoryIds: `${UUID_1}, ${UUID_2}`,
      });

      expect(dto.categoryIds).toEqual([UUID_1, UUID_2]);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('GetBrandsQueryDto', () => {
    it('transforms comma-separated brandIds to array', async () => {
      const dto = plainToInstance(GetBrandsQueryDto, {
        brandIds: `${UUID_1}, ${UUID_2}`,
      });

      expect(dto.brandIds).toEqual([UUID_1, UUID_2]);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
