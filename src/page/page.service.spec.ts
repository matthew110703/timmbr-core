import {
  PageAlreadyExistsException,
  PageNotFoundException,
  PageSectionNotFoundException,
} from '@/common/exceptions/page.exception';
import { Test, TestingModule } from '@nestjs/testing';
import { PageRepository } from './page.repository';
import { PageService } from './page.service';

const PAGE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockPageWithSections = {
  id: PAGE_ID,
  slug: 'home',
  title: 'Home Page',
  description: 'Landing page content',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  sections: [
    {
      id: 'sec-1',
      pageId: PAGE_ID,
      type: 'hero',
      data: { title: 'Welcome to Timmbr', bannerUrl: 'https://cdn.example.com/hero.jpg' },
      order: 0,
      isActive: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    {
      id: 'sec-2',
      pageId: PAGE_ID,
      type: 'promotion',
      data: { discount: '20%' },
      order: 1,
      isActive: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ],
};

const mockPageRepository = {
  findBySlug: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  upsertPageWithSections: jest.fn(),
  delete: jest.fn(),
};

describe('PageService', () => {
  let service: PageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PageService, { provide: PageRepository, useValue: mockPageRepository }],
    }).compile();

    service = module.get<PageService>(PageService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPageBySlug', () => {
    it('returns public page with sections', async () => {
      mockPageRepository.findBySlug.mockResolvedValue(mockPageWithSections);

      const result = await service.getPageBySlug('home', undefined, true);

      expect(mockPageRepository.findBySlug).toHaveBeenCalledWith('home', true);
      expect(result).toMatchObject({
        slug: 'home',
        title: 'Home Page',
        sections: [
          {
            type: 'hero',
            title: 'Welcome to Timmbr',
            bannerUrl: 'https://cdn.example.com/hero.jpg',
          },
          { type: 'promotion', discount: '20%' },
        ],
      });
    });

    it('returns filtered single section when sectionFilter is provided', async () => {
      mockPageRepository.findBySlug.mockResolvedValue(mockPageWithSections);

      const result = await service.getPageBySlug('home', 'hero', true);

      expect(result).toEqual({
        type: 'hero',
        title: 'Welcome to Timmbr',
        bannerUrl: 'https://cdn.example.com/hero.jpg',
      });
    });

    it('throws PageSectionNotFoundException if sectionFilter does not match any section', async () => {
      mockPageRepository.findBySlug.mockResolvedValue(mockPageWithSections);

      const error = await service
        .getPageBySlug('home', 'non-existent', true)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(PageSectionNotFoundException);
    });

    it('throws PageNotFoundException when page is not found in DB', async () => {
      mockPageRepository.findBySlug.mockResolvedValue(null);

      const error = await service.getPageBySlug('home', undefined, true).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(PageNotFoundException);
    });
  });

  describe('listPages', () => {
    it('returns mapped list items', async () => {
      mockPageRepository.findAll.mockResolvedValue([
        {
          id: PAGE_ID,
          slug: 'home',
          title: 'Home Page',
          description: null,
          isActive: true,
          _count: { sections: 2 },
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ]);

      const result = await service.listPages();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        slug: 'home',
        sectionCount: 2,
      });
    });
  });

  describe('createPage', () => {
    it('creates and returns a new page', async () => {
      mockPageRepository.findBySlug.mockResolvedValue(null);
      mockPageRepository.create.mockResolvedValue(mockPageWithSections);

      const result = await service.createPage({
        slug: 'home',
        title: 'Home Page',
        description: 'Landing page content',
      });

      expect(mockPageRepository.create).toHaveBeenCalled();
      expect(result.slug).toBe('home');
    });

    it('throws PageAlreadyExistsException if slug already exists', async () => {
      mockPageRepository.findBySlug.mockResolvedValue(mockPageWithSections);

      const error = await service
        .createPage({
          slug: 'home',
          title: 'Home Page',
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(PageAlreadyExistsException);
    });
  });

  describe('upsertPage', () => {
    it('upserts page and returns response', async () => {
      mockPageRepository.upsertPageWithSections.mockResolvedValue(mockPageWithSections);

      const result = await service.upsertPage('home', {
        title: 'Updated Home',
        sections: [{ type: 'hero', title: 'Welcome to Timmbr' }],
      });

      expect(mockPageRepository.upsertPageWithSections).toHaveBeenCalledWith(
        'home',
        { title: 'Updated Home', description: undefined, isActive: undefined },
        [{ type: 'hero', title: 'Welcome to Timmbr' }],
      );
      expect(result.slug).toBe('home');
    });
  });

  describe('deletePage', () => {
    it('deletes page when found and returns response dto', async () => {
      mockPageRepository.findBySlug.mockResolvedValue(mockPageWithSections);
      mockPageRepository.delete.mockResolvedValue(mockPageWithSections);

      const result = await service.deletePage('home');

      expect(mockPageRepository.delete).toHaveBeenCalledWith(PAGE_ID);
      expect(result).toMatchObject({
        id: PAGE_ID,
        slug: 'home',
      });
    });

    it('throws PageNotFoundException when page does not exist', async () => {
      mockPageRepository.findBySlug.mockResolvedValue(null);

      const error = await service.deletePage('missing').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(PageNotFoundException);
    });
  });
});
