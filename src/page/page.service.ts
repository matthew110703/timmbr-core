import {
  PageAlreadyExistsException,
  PageNotFoundException,
  PageSectionNotFoundException,
} from '@/common/exceptions/page.exception';
import { Injectable } from '@nestjs/common';
import { CreatePageDto } from './dto/create-page.dto';
import { PageListItemResponseDto, PageResponseDto } from './dto/page-response.dto';
import { SectionItemPayload } from './dto/section-item.dto';
import { UpsertPageDto } from './dto/upsert-page.dto';
import { PageMapper } from './page.mapper';
import { PageRepository } from './page.repository';

@Injectable()
export class PageService {
  constructor(private readonly repository: PageRepository) {}

  async getPageBySlug(
    slug: string,
    sectionFilter?: string,
    publicOnly = false,
  ): Promise<PageResponseDto | SectionItemPayload> {
    const normalizedSlug = slug.trim().toLowerCase();
    const page = await this.repository.findBySlug(normalizedSlug, publicOnly);

    if (!page) {
      throw new PageNotFoundException();
    }

    if (sectionFilter) {
      const normalizedFilter = sectionFilter.trim().toLowerCase();
      const section = page.sections.find(
        (s) => s.type.toLowerCase() === normalizedFilter && (!publicOnly || s.isActive),
      );

      if (!section) {
        throw new PageSectionNotFoundException();
      }

      return PageMapper.toSectionResponse(section);
    }

    return PageMapper.toResponse(page);
  }

  async listPages(publicOnly = false): Promise<PageListItemResponseDto[]> {
    const pages = await this.repository.findAll(publicOnly);
    return pages.map((p) => PageMapper.toListItemResponse(p));
  }

  async createPage(dto: CreatePageDto): Promise<PageResponseDto> {
    const normalizedSlug = dto.slug.trim().toLowerCase();
    const existing = await this.repository.findBySlug(normalizedSlug);
    if (existing) {
      throw new PageAlreadyExistsException();
    }

    const created = await this.repository.create(
      {
        slug: normalizedSlug,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
      dto.sections,
    );

    return PageMapper.toResponse(created);
  }

  async upsertPage(slug: string, dto: UpsertPageDto): Promise<PageResponseDto> {
    const normalizedSlug = slug.trim().toLowerCase();
    const result = await this.repository.upsertPageWithSections(
      normalizedSlug,
      {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
      dto.sections,
    );

    return PageMapper.toResponse(result);
  }

  async deletePage(slug: string): Promise<PageResponseDto> {
    const normalizedSlug = slug.trim().toLowerCase();
    const page = await this.repository.findBySlug(normalizedSlug);
    if (!page) {
      throw new PageNotFoundException();
    }

    const deleted = await this.repository.delete(page.id);
    return PageMapper.toResponse(deleted);
  }
}
