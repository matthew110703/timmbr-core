import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';

export type CategoryWithParent = Category & {
  parent: Category | null;
};

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { id },
    });
  }

  async findByIdWithParent(id: string): Promise<CategoryWithParent | null> {
    return this.prisma.category.findUnique({
      where: { id },
      include: { parent: true },
    });
  }

  async findFirst(where: Prisma.CategoryWhereInput): Promise<Category | null> {
    return this.prisma.category.findFirst({
      where,
    });
  }

  async findAllSortedByName(): Promise<Category[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findPaginated(
    where: Prisma.CategoryWhereInput,
    page: number,
    limit: number,
  ): Promise<[CategoryWithParent[], number]> {
    return this.prisma.$transaction(async (tx) => {
      const categories = await tx.category.findMany({
        where,
        include: { parent: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      const total = await tx.category.count({ where });
      return [categories, total] as const;
    });
  }

  async create(
    data: Prisma.CategoryCreateInput | Prisma.CategoryUncheckedCreateInput,
  ): Promise<Category> {
    return this.prisma.category.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.CategoryUpdateInput | Prisma.CategoryUncheckedUpdateInput,
  ): Promise<Category> {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Category> {
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
