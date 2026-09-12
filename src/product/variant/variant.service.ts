import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ProductRepository } from '../product.repository';
import { VariantRepository } from './variant.repository';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { GetVariantsQueryDto } from './dto/get-variants-query.dto';
import { VariantResponseDto } from './dto/variant-response.dto';
import { VariantMapper } from './variant.mapper';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';
import {
  VariantAlreadyExistsException,
  VariantInvalidPriceException,
  VariantNotFoundException,
} from '@/common/exceptions/variant.exception';
import { PaginatedResult } from '@/common/types/api-response.types';
import { Prisma, ProductStatus, VariantStatus } from '@prisma/client';

@Injectable()
export class VariantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly variantRepository: VariantRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async create(productId: string, dto: CreateVariantDto): Promise<VariantResponseDto> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const existingSku = await this.variantRepository.findBySku(dto.sku);
    if (existingSku) {
      throw new VariantAlreadyExistsException();
    }

    if (dto.compareAtPrice !== undefined && dto.compareAtPrice !== null) {
      if (dto.compareAtPrice < dto.price) {
        throw new VariantInvalidPriceException();
      }
    }

    const existingCount = await this.variantRepository.count({ productId });
    const isFirstVariant = existingCount === 0;
    const shouldBeDefault = isFirstVariant || dto.isDefault === true;

    const variant = await this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault && !isFirstVariant) {
        await tx.productVariant.updateMany({
          where: { productId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.productVariant.create({
        data: {
          productId,
          sku: dto.sku,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice ?? null,
          currency: dto.currency ?? 'INR',
          status: dto.status ?? VariantStatus.ACTIVE,
          isDefault: shouldBeDefault,
          inventory: {
            create: {
              quantity: 0,
              reservedQuantity: 0,
            },
          },
        },
        include: { inventory: true },
      });
    });

    return VariantMapper.toResponse(variant);
  }

  async update(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<VariantResponseDto> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const existingVariant = await this.variantRepository.findById(variantId);
    if (!existingVariant || existingVariant.productId !== productId) {
      throw new VariantNotFoundException();
    }

    if (dto.sku && dto.sku.toUpperCase() !== existingVariant.sku.toUpperCase()) {
      const duplicateSku = await this.variantRepository.findBySku(dto.sku);
      if (duplicateSku && duplicateSku.id !== variantId) {
        throw new VariantAlreadyExistsException();
      }
    }

    const effectivePrice = dto.price !== undefined ? dto.price : Number(existingVariant.price);
    const effectiveCompareAtPrice =
      dto.compareAtPrice !== undefined
        ? dto.compareAtPrice
        : existingVariant.compareAtPrice !== null && existingVariant.compareAtPrice !== undefined
          ? Number(existingVariant.compareAtPrice)
          : null;

    if (
      effectiveCompareAtPrice !== null &&
      effectiveCompareAtPrice !== undefined &&
      effectiveCompareAtPrice < effectivePrice
    ) {
      throw new VariantInvalidPriceException();
    }

    const targetStatus = dto.status ?? existingVariant.status;
    const isBecomingDiscontinuedOrHidden =
      (targetStatus === VariantStatus.DISCONTINUED || targetStatus === VariantStatus.HIDDEN) &&
      existingVariant.status !== VariantStatus.DISCONTINUED &&
      existingVariant.status !== VariantStatus.HIDDEN;

    let willBeDefault = dto.isDefault !== undefined ? dto.isDefault : existingVariant.isDefault;

    const updatedVariant = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true && !existingVariant.isDefault) {
        await tx.productVariant.updateMany({
          where: { productId, id: { not: variantId }, isDefault: true },
          data: { isDefault: false },
        });
      }

      if (existingVariant.isDefault && isBecomingDiscontinuedOrHidden) {
        willBeDefault = false;

        const candidate = await tx.productVariant.findFirst({
          where: {
            productId,
            id: { not: variantId },
            status: VariantStatus.ACTIVE,
          },
          orderBy: { createdAt: 'asc' },
        });

        if (candidate) {
          await tx.productVariant.update({
            where: { id: candidate.id },
            data: { isDefault: true },
          });
        } else {
          const fallbackCandidate = await tx.productVariant.findFirst({
            where: {
              productId,
              id: { not: variantId },
              status: { notIn: [VariantStatus.DISCONTINUED, VariantStatus.HIDDEN] },
            },
            orderBy: { createdAt: 'asc' },
          });

          if (fallbackCandidate) {
            await tx.productVariant.update({
              where: { id: fallbackCandidate.id },
              data: { isDefault: true },
            });
          }
        }
      }

      return tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...(dto.sku && { sku: dto.sku }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.compareAtPrice !== undefined && { compareAtPrice: dto.compareAtPrice }),
          ...(dto.currency && { currency: dto.currency }),
          ...(dto.status && { status: dto.status }),
          isDefault: willBeDefault,
        },
        include: { inventory: true },
      });
    });

    return VariantMapper.toResponse(updatedVariant);
  }

  async getAllVariants(
    productId: string,
    query: GetVariantsQueryDto,
    onlyActive = false,
  ): Promise<PaginatedResult<VariantResponseDto>> {
    const product = await this.productRepository.findFirst({
      id: productId,
      ...(onlyActive
        ? {
            status: ProductStatus.ACTIVE,
            variants: {
              some: {
                status: VariantStatus.ACTIVE,
              },
            },
          }
        : {}),
    });
    if (!product) {
      throw new ProductNotFoundException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.ProductVariantWhereInput = {
      productId,
      ...(onlyActive
        ? {
            status: VariantStatus.ACTIVE,
          }
        : query.status && { status: query.status }),
      ...(query.isDefault !== undefined && { isDefault: query.isDefault }),
    };

    const [variants, total] = await this.variantRepository.findPaginated(where, page, limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: variants.map((variant) => VariantMapper.toResponse(variant)),
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

  async getVariantById(
    productId: string,
    variantId: string,
    onlyActive = false,
  ): Promise<VariantResponseDto> {
    const product = await this.productRepository.findFirst({
      id: productId,
      ...(onlyActive
        ? {
            status: ProductStatus.ACTIVE,
            variants: {
              some: {
                status: VariantStatus.ACTIVE,
              },
            },
          }
        : {}),
    });
    if (!product) {
      throw new ProductNotFoundException();
    }

    const variant = await this.variantRepository.findById(variantId);
    if (!variant || variant.productId !== productId) {
      throw new VariantNotFoundException();
    }

    if (onlyActive && variant.status !== VariantStatus.ACTIVE) {
      throw new VariantNotFoundException();
    }

    return VariantMapper.toResponse(variant);
  }
}
