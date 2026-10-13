import { Injectable } from '@nestjs/common';
import { AttributeOption, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AttributeOptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDefinition(definitionId: string): Promise<AttributeOption[]> {
    return this.prisma.attributeOption.findMany({
      where: { definitionId },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async findById(id: string): Promise<AttributeOption | null> {
    return this.prisma.attributeOption.findUnique({ where: { id } });
  }

  async create(data: Prisma.AttributeOptionUncheckedCreateInput): Promise<AttributeOption> {
    return this.prisma.attributeOption.create({ data });
  }

  async update(id: string, data: Prisma.AttributeOptionUpdateInput): Promise<AttributeOption> {
    return this.prisma.attributeOption.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.attributeOption.delete({ where: { id } });
  }

  async countUsage(id: string): Promise<number> {
    return this.prisma.attributeValueOption.count({ where: { optionId: id } });
  }
}
