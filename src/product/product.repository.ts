import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Product, Prisma, VariantStatus } from '@prisma/client';
import { ProductWithDetails } from './product.mapper';

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

  async findByIdWithDetails(
    id: string,
    onlyActiveVariants = false,
  ): Promise<ProductWithDetails | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        attributeValues: {
          where: { productId: { not: null } },
          include: {
            definition: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        variants: {
          where: onlyActiveVariants ? { status: VariantStatus.ACTIVE } : undefined,
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          include: {
            inventory: true,
            attributeValues: {
              include: {
                definition: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
  }

  async findBySlugWithDetails(
    slug: string,
    onlyActiveVariants = false,
  ): Promise<ProductWithDetails | null> {
    return this.prisma.product.findUnique({
      where: { slug },
      include: {
        attributeValues: {
          where: { productId: { not: null } },
          include: {
            definition: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        variants: {
          where: onlyActiveVariants ? { status: VariantStatus.ACTIVE } : undefined,
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          include: {
            inventory: true,
            attributeValues: {
              include: {
                definition: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
  }

  async findFirstWithDetails(
    where: Prisma.ProductWhereInput,
    onlyActiveVariants = false,
  ): Promise<ProductWithDetails | null> {
    return this.prisma.product.findFirst({
      where,
      include: {
        attributeValues: {
          where: { productId: { not: null } },
          include: {
            definition: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        variants: {
          where: onlyActiveVariants ? { status: VariantStatus.ACTIVE } : undefined,
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          include: {
            inventory: true,
            attributeValues: {
              include: {
                definition: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
  }

  async findPaginated(
    where: Prisma.ProductWhereInput,
    page: number,
    limit: number,
  ): Promise<[ProductWithDetails[], number]> {
    return this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
            take: 1,
          },
          variants: {
            where: { status: VariantStatus.ACTIVE },
            orderBy: [{ isDefault: 'desc' }, { price: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              productId: true,
              sku: true,
              price: true,
              compareAtPrice: true,
              currency: true,
              isDefault: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
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
