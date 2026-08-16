import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { ProductVariant, Prisma } from '@prisma/client';

@Injectable()
export class VariantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProductVariant | null> {
    return this.prisma.productVariant.findUnique({
      where: { id },
    });
  }

  async findBySku(sku: string): Promise<ProductVariant | null> {
    return this.prisma.productVariant.findUnique({
      where: { sku },
    });
  }

  async findFirst(where: Prisma.ProductVariantWhereInput): Promise<ProductVariant | null> {
    return this.prisma.productVariant.findFirst({
      where,
    });
  }

  async findMany(
    where: Prisma.ProductVariantWhereInput,
    orderBy: Prisma.ProductVariantOrderByWithRelationInput = { createdAt: 'asc' },
  ): Promise<ProductVariant[]> {
    return this.prisma.productVariant.findMany({
      where,
      orderBy,
    });
  }

  async count(where: Prisma.ProductVariantWhereInput): Promise<number> {
    return this.prisma.productVariant.count({ where });
  }

  async findPaginated(
    where: Prisma.ProductVariantWhereInput,
    page: number,
    limit: number,
  ): Promise<[ProductVariant[], number]> {
    return this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.productVariant.count({ where }),
    ]);
  }

  async create(
    data: Prisma.ProductVariantCreateInput | Prisma.ProductVariantUncheckedCreateInput,
  ): Promise<ProductVariant> {
    return this.prisma.productVariant.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.ProductVariantUpdateInput | Prisma.ProductVariantUncheckedUpdateInput,
  ): Promise<ProductVariant> {
    return this.prisma.productVariant.update({
      where: { id },
      data,
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
