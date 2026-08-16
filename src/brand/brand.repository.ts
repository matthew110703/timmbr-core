import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';

@Injectable()
export class BrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Brand | null> {
    return this.prisma.brand.findUnique({
      where: { id },
    });
  }

  async findFirst(where: Prisma.BrandWhereInput): Promise<Brand | null> {
    return this.prisma.brand.findFirst({
      where,
    });
  }

  async findPaginated(
    where: Prisma.BrandWhereInput,
    page: number,
    limit: number,
  ): Promise<[Brand[], number]> {
    return this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brand.count({ where }),
    ]);
  }

  async create(data: Prisma.BrandCreateInput | Prisma.BrandUncheckedCreateInput): Promise<Brand> {
    return this.prisma.brand.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.BrandUpdateInput | Prisma.BrandUncheckedUpdateInput,
  ): Promise<Brand> {
    return this.prisma.brand.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Brand> {
    return this.prisma.brand.delete({
      where: { id },
    });
  }
}
