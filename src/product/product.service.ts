import { Injectable } from '@nestjs/common';
import { ProductStatus, VariantStatus, Prisma } from '@prisma/client';
import { ProductRepository } from './product.repository';
import { CategoryRepository } from '@/category/category.repository';
import { BrandRepository } from '@/brand/brand.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductMapper } from './product.mapper';
import {
  ProductAlreadyExistsException,
  ProductNotFoundException,
} from '@/common/exceptions/product.exception';
import { CategoryNotFoundException } from '@/common/exceptions/category.exception';
import { BrandNotFoundException } from '@/common/exceptions/brand.exception';
import { generateSlug } from '@/common/utils/helpers';
import { PaginatedResult } from '@/common/types/api-response.types';
import { AttributeValueService } from './attribute/services/attribute-value.service';
import { ProductCacheService } from './cache/product-cache.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly brandRepository: BrandRepository,
    private readonly attributeValueService: AttributeValueService,
    private readonly cacheService: ProductCacheService,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    const categoryExists = await this.categoryRepository.findById(dto.categoryId);
    if (!categoryExists) {
      throw new CategoryNotFoundException();
    }

    if (dto.brandId) {
      const brandExists = await this.brandRepository.findById(dto.brandId);
      if (!brandExists) {
        throw new BrandNotFoundException();
      }
    }

    const existingProduct = await this.productRepository.findFirst({
      title: { equals: dto.title, mode: 'insensitive' },
    });

    if (existingProduct) {
      throw new ProductAlreadyExistsException();
    }

    const slug = generateSlug(dto.title);

    const product = await this.productRepository.create({
      title: dto.title,
      slug,
      description: dto.description,
      shortDescription: dto.shortDescription,
      status: ProductStatus.DRAFT,
      hsnCode: dto.hsnCode,
      gstRate: dto.gstRate ?? 18,
      brandId: dto.brandId,
      categoryId: dto.categoryId,
    });

    return ProductMapper.toResponse(product);
  }

  async update(productId: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    const existingProduct = await this.productRepository.findById(productId);

    if (!existingProduct) {
      throw new ProductNotFoundException();
    }

    if (dto.categoryId !== undefined) {
      const categoryExists = await this.categoryRepository.findById(dto.categoryId);
      if (!categoryExists) {
        throw new CategoryNotFoundException();
      }
    }

    if (dto.brandId !== undefined && dto.brandId !== null) {
      const brandExists = await this.brandRepository.findById(dto.brandId);
      if (!brandExists) {
        throw new BrandNotFoundException();
      }
    }

    let slug: string | undefined;

    if (
      dto.title !== undefined &&
      dto.title.toLowerCase() !== existingProduct.title.toLowerCase()
    ) {
      const duplicate = await this.productRepository.findFirst({
        id: { not: productId },
        title: { equals: dto.title, mode: 'insensitive' },
      });

      if (duplicate) {
        throw new ProductAlreadyExistsException();
      }

      slug = generateSlug(dto.title);
    }

    const product = await this.productRepository.update(productId, {
      ...(dto.title && { title: dto.title, slug }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.shortDescription && { shortDescription: dto.shortDescription }),
      ...(dto.status && { status: dto.status }),
      ...(dto.hsnCode !== undefined && { hsnCode: dto.hsnCode }),
      ...(dto.gstRate !== undefined && { gstRate: dto.gstRate }),
      ...(dto.brandId !== undefined && { brandId: dto.brandId }),
      ...(dto.categoryId && { categoryId: dto.categoryId }),
    });

    this.invalidateProductCache(productId, existingProduct.slug);
    if (slug) {
      this.invalidateProductCache(productId, slug);
    }

    return ProductMapper.toResponse(product);
  }

  async getAllProducts(
    query: GetProductsQueryDto,
    onlyActive = false,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.ProductWhereInput = {
      ...(onlyActive
        ? {
            status: ProductStatus.ACTIVE,
            variants: {
              some: {
                status: VariantStatus.ACTIVE,
              },
            },
          }
        : query.status && { status: query.status }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.brandId && { brandId: query.brandId }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { shortDescription: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [products, total] = await this.productRepository.findPaginated(where, page, limit);

    const totalPages = Math.ceil(total / limit);

    return {
      data: products.map((product) => ProductMapper.toResponse(product)),
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

  invalidateProductCache(productId?: string, slug?: string): void {
    this.cacheService.invalidate(productId, slug);
  }

  async getProductById(productId: string, onlyActive = false): Promise<ProductResponseDto> {
    const cacheKey = `id:${productId}:${onlyActive}`;
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await this.productRepository.findByIdWithDetails(productId, onlyActive);

    if (!product) {
      throw new ProductNotFoundException();
    }

    if (onlyActive && product.status !== ProductStatus.ACTIVE) {
      throw new ProductNotFoundException();
    }

    const response = ProductMapper.toResponse(product);
    this.cacheService.set(product.id, product.slug, onlyActive, response);

    return response;
  }

  async getProductBySlug(slug: string, onlyActive = false): Promise<ProductResponseDto> {
    const cacheKey = `slug:${slug}:${onlyActive}`;
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await this.productRepository.findBySlugWithDetails(slug, onlyActive);

    if (!product) {
      throw new ProductNotFoundException();
    }

    if (onlyActive && product.status !== ProductStatus.ACTIVE) {
      throw new ProductNotFoundException();
    }

    const response = ProductMapper.toResponse(product);
    this.cacheService.set(product.id, product.slug, onlyActive, response);

    return response;
  }

  async getFilterMetadata() {
    return this.attributeValueService.getFilterMetadata();
  }

  async delete(productId: string): Promise<ProductResponseDto> {
    const existingProduct = await this.productRepository.findById(productId);

    if (!existingProduct) {
      throw new ProductNotFoundException();
    }

    this.invalidateProductCache(productId, existingProduct.slug);

    const product = await this.productRepository.delete(productId);

    return ProductMapper.toResponse(product);
  }
}
