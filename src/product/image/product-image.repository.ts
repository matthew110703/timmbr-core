import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma, ProductImage } from '@prisma/client';

@Injectable()
export class ProductImageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProductImage | null> {
    return this.prisma.productImage.findUnique({
      where: { id },
    });
  }

  async findFirst(where: Prisma.ProductImageWhereInput): Promise<ProductImage | null> {
    return this.prisma.productImage.findFirst({
      where,
    });
  }

  async findMany(
    where: Prisma.ProductImageWhereInput,
    orderBy: Prisma.ProductImageOrderByWithRelationInput[] = [
      { isPrimary: 'desc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  ): Promise<ProductImage[]> {
    return this.prisma.productImage.findMany({
      where,
      orderBy,
    });
  }

  async create(data: Prisma.ProductImageUncheckedCreateInput): Promise<ProductImage> {
    return this.prisma.productImage.create({
      data,
    });
  }

  async createMany(
    productId: string,
    items: Omit<Prisma.ProductImageUncheckedCreateInput, 'productId'>[],
    hasPrimary: boolean,
  ): Promise<ProductImage[]> {
    return this.prisma.$transaction(async (tx) => {
      if (hasPrimary) {
        await tx.productImage.updateMany({
          where: { productId },
          data: { isPrimary: false },
        });
      }

      const created: ProductImage[] = [];
      for (const item of items) {
        const record = await tx.productImage.create({
          data: {
            ...item,
            productId,
          },
        });
        created.push(record);
      }

      return created;
    });
  }

  async setPrimary(productId: string, imageId: string): Promise<ProductImage> {
    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: {
          productId,
          id: { not: imageId },
        },
        data: { isPrimary: false },
      });

      return tx.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      });
    });
  }

  async deleteManyByIds(productId: string, imageIds: string[]): Promise<ProductImage[]> {
    return this.prisma.$transaction(async (tx) => {
      const targets = await tx.productImage.findMany({
        where: {
          productId,
          id: { in: imageIds },
        },
      });

      if (targets.length > 0) {
        await tx.productImage.deleteMany({
          where: {
            productId,
            id: { in: targets.map((t) => t.id) },
          },
        });
      }

      return targets;
    });
  }
}
