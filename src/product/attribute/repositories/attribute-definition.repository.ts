import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AttributeDefinitionWithCount } from '../mappers/attribute.mapper';

@Injectable()
export class AttributeDefinitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.AttributeDefinitionCreateInput): Promise<AttributeDefinitionWithCount> {
    return this.prisma.attributeDefinition.create({
      data,
      include: {
        _count: {
          select: { values: true },
        },
      },
    });
  }

  async findById(id: string): Promise<AttributeDefinitionWithCount | null> {
    return this.prisma.attributeDefinition.findUnique({
      where: { id },
      include: {
        _count: {
          select: { values: true },
        },
      },
    });
  }

  async findByName(
    name: string,
    productId: string | null = null,
  ): Promise<AttributeDefinitionWithCount | null> {
    return this.prisma.attributeDefinition.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        productId: productId ? productId : null,
      },
      include: {
        _count: {
          select: { values: true },
        },
      },
    });
  }

  async findPaginated(
    where: Prisma.AttributeDefinitionWhereInput,
    page: number,
    limit: number,
  ): Promise<[AttributeDefinitionWithCount[], number]> {
    const skip = (page - 1) * limit;

    return this.prisma.$transaction([
      this.prisma.attributeDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { values: true },
          },
        },
      }),
      this.prisma.attributeDefinition.count({ where }),
    ]);
  }

  async update(
    id: string,
    data: Prisma.AttributeDefinitionUpdateInput,
  ): Promise<AttributeDefinitionWithCount> {
    return this.prisma.attributeDefinition.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { values: true },
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.attributeDefinition.delete({
      where: { id },
    });
  }

  async countUsage(id: string): Promise<number> {
    return this.prisma.attributeValue.count({
      where: { definitionId: id },
    });
  }
}
