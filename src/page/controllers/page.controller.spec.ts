import { Test, TestingModule } from '@nestjs/testing';
import { PageService } from '../page.service';
import { PageController } from './page.controller';

const mockPageService = {
  getPageBySlug: jest.fn(),
};

describe('PageController', () => {
  let controller: PageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PageController],
      providers: [{ provide: PageService, useValue: mockPageService }],
    }).compile();

    controller = module.get<PageController>(PageController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPageBySlug', () => {
    it('calls service.getPageBySlug with publicOnly=true', async () => {
      const mockResult = {
        id: '1',
        slug: 'home',
        title: 'Home',
        description: null,
        isActive: true,
        sections: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPageService.getPageBySlug.mockResolvedValue(mockResult);

      const result = await controller.getPageBySlug('home', {});

      expect(mockPageService.getPageBySlug).toHaveBeenCalledWith('home', undefined, true);
      expect(result).toBe(mockResult);
    });

    it('passes section query parameter to service', async () => {
      const mockSection = { type: 'hero', title: 'Test' };
      mockPageService.getPageBySlug.mockResolvedValue(mockSection);

      const result = await controller.getPageBySlug('home', { section: 'hero' });

      expect(mockPageService.getPageBySlug).toHaveBeenCalledWith('home', 'hero', true);
      expect(result).toBe(mockSection);
    });
  });
});
