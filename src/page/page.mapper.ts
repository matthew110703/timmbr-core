import { Page, PageSection } from '@prisma/client';
import { PageListItemResponseDto, PageResponseDto } from './dto/page-response.dto';
import { SectionItemPayload } from './dto/section-item.dto';

export type PageWithSections = Page & { sections: PageSection[] };
export type PageWithSectionCount = Page & { _count: { sections: number } };

export class PageMapper {
  static toSectionResponse(section: PageSection): SectionItemPayload {
    const dataObj =
      typeof section.data === 'object' && section.data !== null && !Array.isArray(section.data)
        ? (section.data as Record<string, unknown>)
        : {};

    return {
      type: section.type,
      ...dataObj,
    };
  }

  static toResponse(page: PageWithSections): PageResponseDto {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      description: page.description ?? null,
      isActive: page.isActive,
      sections: (page.sections ?? []).map((s) => PageMapper.toSectionResponse(s)),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  static toListItemResponse(page: PageWithSectionCount): PageListItemResponseDto {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      description: page.description ?? null,
      isActive: page.isActive,
      sectionCount: page._count.sections,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }
}
