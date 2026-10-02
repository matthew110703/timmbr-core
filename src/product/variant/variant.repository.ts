import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { ProductVariant, Prisma } from '@prisma/client';
import { ProductVariantWithInventory } from './variant.mapper';

@Injectable()
export class VariantRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly variantInclude = {
    inventory: true,
    attributeValues: {
      include: {
        definition: true,
      },
      orderBy: { createdAt: 'asc' as const },
    },
  };

  async findById(id: string): Promise<ProductVariantWithInventory | null> {
    return this.prisma.productVariant.findUnique({
      where: { id },
      include: this.variantInclude,
    });
  }

  async findBySku(sku: string): Promise<ProductVariantWithInventory | null> {
    return this.prisma.productVariant.findUnique({
      where: { sku },
      include: this.variantInclude,
    });
  }

  async findFirst(
    where: Prisma.ProductVariantWhereInput,
  ): Promise<ProductVariantWithInventory | null> {
    return this.prisma.productVariant.findFirst({
      where,
      include: this.variantInclude,
    });
  }

  async findMany(
    where: Prisma.ProductVariantWhereInput,
    orderBy: Prisma.ProductVariantOrderByWithRelationInput = { createdAt: 'asc' },
  ): Promise<ProductVariantWithInventory[]> {
    return this.prisma.productVariant.findMany({
      where,
      orderBy,
      include: this.variantInclude,
    });
  }

  async count(where: Prisma.ProductVariantWhereInput): Promise<number> {
    return this.prisma.productVariant.count({ where });
  }

  async findPaginated(
    where: Prisma.ProductVariantWhereInput,
    page: number,
    limit: number,
  ): Promise<[ProductVariantWithInventory[], number]> {
    return this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: this.variantInclude,
      }),
      this.prisma.productVariant.count({ where }),
    ]);
  }

  async create(
    data: Prisma.ProductVariantCreateInput | Prisma.ProductVariantUncheckedCreateInput,
  ): Promise<ProductVariantWithInventory> {
    return this.prisma.productVariant.create({
      data,
      include: { inventory: true },
    });
  }

  async update(
    id: string,
    data: Prisma.ProductVariantUpdateInput | Prisma.ProductVariantUncheckedUpdateInput,
  ): Promise<ProductVariantWithInventory> {
    return this.prisma.productVariant.update({
      where: { id },
      data,
      include: { inventory: true },
    });
  }

  async updateMany(
    where: Prisma.ProductVariantWhereInput,
    data: Prisma.ProductVariantUpdateManyMutationInput,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.productVariant.updateMany({
      where,
      data,
    });
  }

  async delete(id: string): Promise<ProductVariant> {
    return this.prisma.productVariant.delete({
      where: { id },
    });
  }
}
