import { Injectable, Logger } from '@nestjs/common';
import { ProductImageRepository } from './product-image.repository';
import { ProductRepository } from '../product.repository';
import { VariantRepository } from '../variant/variant.repository';
import { MediaService } from '@/media/media.service';
import { PresignProductImagesDto } from './dto/presign-product-images.dto';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { DeleteProductImagesDto } from './dto/delete-product-images.dto';
import { GetProductImagesQueryDto } from './dto/get-product-images-query.dto';
import { ProductImageResponseDto } from './dto/product-image-response.dto';
import { ProductImageMapper } from './product-image.mapper';
import {
  ProductImageInvalidStorageKeyException,
  ProductImageInvalidVariantException,
  ProductImageNotFoundException,
  ProductImageObjectNotFoundInStorageException,
  ProductNotFoundException,
} from '@/common/exceptions/product.exception';

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  constructor(
    private readonly repository: ProductImageRepository,
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: VariantRepository,
    private readonly mediaService: MediaService,
  ) {}

  async presignUploadUrls(productId: string, dto: PresignProductImagesDto) {
    await this.ensureProductExists(productId);

    return this.mediaService.getPresignedUploadUrls({
      folder: `products/${productId}/images`,
      files: dto.files,
    });
  }

  async registerImages(
    productId: string,
    dto: CreateProductImagesDto,
  ): Promise<{ images: ProductImageResponseDto[] }> {
    await this.ensureProductExists(productId);

    const expectedPrefix = `products/${productId}/images/`;

    // 1. Validate storage keys prefix & format
    for (const image of dto.images) {
      if (!image.storageKey.startsWith(expectedPrefix)) {
        throw new ProductImageInvalidStorageKeyException(image.storageKey);
      }
    }

    // 2. Validate variant association if specified
    for (const image of dto.images) {
      if (image.variantId) {
        const variant = await this.variantRepository.findById(image.variantId);
        if (!variant || variant.productId !== productId) {
          throw new ProductImageInvalidVariantException();
        }
      }
    }

    // 3. Verify that all objects exist in Cloudflare R2 / S3 before saving to database
    const existenceChecks = await Promise.all(
      dto.images.map(async (image) => ({
        storageKey: image.storageKey,
        exists: await this.mediaService.exists(image.storageKey),
      })),
    );

    const missing = existenceChecks.find((check) => !check.exists);
    if (missing) {
      throw new ProductImageObjectNotFoundInStorageException(missing.storageKey);
    }

    const hasPrimary = dto.images.some((img) => img.isPrimary === true);

    // If multiple items in the batch have isPrimary = true, only keep the last one as primary
    if (hasPrimary) {
      let lastPrimaryIndex = -1;
      dto.images.forEach((img, idx) => {
        if (img.isPrimary) {
          lastPrimaryIndex = idx;
        }
      });
      dto.images.forEach((img, idx) => {
        img.isPrimary = idx === lastPrimaryIndex;
      });
    }

    const itemsToCreate = dto.images.map((img) => ({
      storageKey: img.storageKey,
      variantId: img.variantId ?? null,
      altText: img.altText ?? null,
      sortOrder: img.sortOrder ?? 0,
      isPrimary: img.isPrimary ?? false,
    }));

    const created = await this.repository.createMany(productId, itemsToCreate, hasPrimary);

    const images = created.map((img) =>
      ProductImageMapper.toResponse(img, this.mediaService.getPublicUrl(img.storageKey)),
    );

    return { images };
  }

  async setPrimaryImage(productId: string, imageId: string): Promise<ProductImageResponseDto> {
    await this.ensureProductExists(productId);

    const image = await this.repository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new ProductImageNotFoundException();
    }

    const updated = await this.repository.setPrimary(productId, imageId);

    return ProductImageMapper.toResponse(
      updated,
      this.mediaService.getPublicUrl(updated.storageKey),
    );
  }

  async deleteImages(
    productId: string,
    dto: DeleteProductImagesDto,
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    await this.ensureProductExists(productId);

    const deletedRecords = await this.repository.deleteManyByIds(productId, dto.imageIds);

    if (deletedRecords.length === 0) {
      throw new ProductImageNotFoundException();
    }

    // Clean up binaries from Cloudflare R2 / S3 storage asynchronously
    await Promise.allSettled(
      deletedRecords.map(async (record) => {
        try {
          await this.mediaService.delete(record.storageKey);
        } catch (error) {
          this.logger.error(`Failed to delete storage key ${record.storageKey} from R2`, error);
        }
      }),
    );

    return {
      deletedCount: deletedRecords.length,
      deletedIds: deletedRecords.map((r) => r.id),
    };
  }

  async getImages(
    productId: string,
    query?: GetProductImagesQueryDto,
  ): Promise<{ images: ProductImageResponseDto[] }> {
    await this.ensureProductExists(productId);

    const where = {
      productId,
      ...(query?.variantId ? { variantId: query.variantId } : {}),
    };

    const records = await this.repository.findMany(where);

    const images = records.map((img) =>
      ProductImageMapper.toResponse(img, this.mediaService.getPublicUrl(img.storageKey)),
    );

    return { images };
  }

  private async ensureProductExists(productId: string): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }
  }
}
