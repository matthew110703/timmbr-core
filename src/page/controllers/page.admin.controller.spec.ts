import { Test, TestingModule } from '@nestjs/testing';
import { PageService } from '../page.service';
import { PageAdminController } from './page.admin.controller';

const mockPageService = {
  listPages: jest.fn(),
  getPageBySlug: jest.fn(),
  createPage: jest.fn(),
  upsertPage: jest.fn(),
  deletePage: jest.fn(),
};

describe('PageAdminController', () => {
  let controller: PageAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PageAdminController],
      providers: [{ provide: PageService, useValue: mockPageService }],
    }).compile();

    controller = module.get<PageAdminController>(PageAdminController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to service.listPages', async () => {
      mockPageService.listPages.mockResolvedValue([]);
      const result = await controller.getAll();
      expect(mockPageService.listPages).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getPageBySlug', () => {
    it('delegates to service.getPageBySlug with publicOnly=false', async () => {
      const mockResult = { slug: 'home' };
      mockPageService.getPageBySlug.mockResolvedValue(mockResult);

      const result = await controller.getPageBySlug('home', { section: 'hero' });

      expect(mockPageService.getPageBySlug).toHaveBeenCalledWith('home', 'hero', false);
      expect(result).toBe(mockResult);
    });
  });

  describe('create', () => {
    it('delegates to service.createPage', async () => {
      const dto = { slug: 'home', title: 'Home' };
      mockPageService.createPage.mockResolvedValue(dto);

      const result = await controller.create(dto);

      expect(mockPageService.createPage).toHaveBeenCalledWith(dto);
      expect(result).toBe(dto);
    });
  });

  describe('upsertPage', () => {
    it('delegates to service.upsertPage', async () => {
      const dto = { title: 'Updated' };
      mockPageService.upsertPage.mockResolvedValue(dto);

      const result = await controller.upsertPage('home', dto);

      expect(mockPageService.upsertPage).toHaveBeenCalledWith('home', dto);
      expect(result).toBe(dto);
    });
  });

  describe('deletePage', () => {
    it('delegates to service.deletePage', async () => {
      const mockDeleted = { id: '1', slug: 'home' };
      mockPageService.deletePage.mockResolvedValue(mockDeleted);

      const result = await controller.deletePage('home');

      expect(mockPageService.deletePage).toHaveBeenCalledWith('home');
      expect(result).toBe(mockDeleted);
    });
  });
});
