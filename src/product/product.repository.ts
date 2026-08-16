import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Product, Prisma } from '@prisma/client';

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { slug },
    });
  }

  async findFirst(where: Prisma.ProductWhereInput): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where,
    });
  }

  async findPaginated(
    where: Prisma.ProductWhereInput,
    page: number,
    limit: number,
  ): Promise<[Product[], number]> {
    return this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
  }

  async create(
    data: Prisma.ProductCreateInput | Prisma.ProductUncheckedCreateInput,
  ): Promise<Product> {
    return this.prisma.product.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.ProductUpdateInput | Prisma.ProductUncheckedUpdateInput,
  ): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Product> {
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
