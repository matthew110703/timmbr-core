import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SectionItemPayload } from './dto/section-item.dto';
import { PageWithSectionCount, PageWithSections } from './page.mapper';

@Injectable()
export class PageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(identifier: string, activeOnly = false): Promise<PageWithSections | null> {
    return this.prisma.page.findFirst({
      where: {
        OR: [{ slug: identifier }, { id: identifier }],
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        sections: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findAll(activeOnly = false): Promise<PageWithSectionCount[]> {
    return this.prisma.page.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: {
        _count: {
          select: { sections: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    pageData: {
      slug: string;
      title: string;
      description?: string;
      isActive?: boolean;
    },
    sections?: SectionItemPayload[],
  ): Promise<PageWithSections> {
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          slug: pageData.slug,
          title: pageData.title,
          description: pageData.description ?? null,
          isActive: pageData.isActive ?? true,
        },
      });

      if (sections && sections.length > 0) {
        await this.createSectionsTx(tx, page.id, sections);
      }

      const created = await tx.page.findUnique({
        where: { id: page.id },
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return created!;
    });
  }

  async upsertPageWithSections(
    slug: string,
    pageData: {
      title?: string;
      description?: string;
      isActive?: boolean;
    },
    sections?: SectionItemPayload[],
  ): Promise<PageWithSections> {
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.upsert({
        where: { slug },
        update: {
          ...(pageData.title !== undefined ? { title: pageData.title } : {}),
          ...(pageData.description !== undefined ? { description: pageData.description } : {}),
          ...(pageData.isActive !== undefined ? { isActive: pageData.isActive } : {}),
        },
        create: {
          slug,
          title: pageData.title ?? slug.charAt(0).toUpperCase() + slug.slice(1),
          description: pageData.description ?? null,
          isActive: pageData.isActive ?? true,
        },
      });

      if (sections !== undefined) {
        await tx.pageSection.deleteMany({
          where: { pageId: page.id },
        });

        if (sections.length > 0) {
          await this.createSectionsTx(tx, page.id, sections);
        }
      }

      const result = await tx.page.findUnique({
        where: { id: page.id },
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return result!;
    });
  }

  async delete(id: string): Promise<PageWithSections> {
    return this.prisma.page.delete({
      where: { id },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  private async createSectionsTx(
    tx: Prisma.TransactionClient,
    pageId: string,
    sections: SectionItemPayload[],
  ): Promise<void> {
    for (let i = 0; i < sections.length; i++) {
      const { type, ...rest } = sections[i];
      const sectionData = (rest['data'] ?? rest) as Prisma.InputJsonValue;
      const order = typeof rest['order'] === 'number' ? rest['order'] : i;
      const isActive = typeof rest['isActive'] === 'boolean' ? rest['isActive'] : true;

      await tx.pageSection.create({
        data: {
          pageId,
          type: type.trim().toLowerCase(),
          data: sectionData,
          order,
          isActive,
        },
      });
    }
  }
}
