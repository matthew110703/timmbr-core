import { Test, TestingModule } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

const mockUserService: Partial<UserService> = {
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
};

const mockReq = (sub = 'user-id-1') =>
  ({ user: { sub, email: 'test@example.com', role: 'USER' } }) as unknown as FastifyRequest;

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── getProfile ──────────────────────────────────────────────────────────────

  describe('getProfile (GET /user/me)', () => {
    it('calls user.getProfile with the authenticated user id and returns the result', async () => {
      const expected = { id: 'user-id-1', name: 'Test User' };
      (mockUserService.getProfile as jest.Mock).mockResolvedValue(expected);

      const result = await controller.getProfile(mockReq());

      expect(mockUserService.getProfile).toHaveBeenCalledWith('user-id-1');
      expect(result).toBe(expected);
    });
  });

  // ─── updateProfile ───────────────────────────────────────────────────────────

  describe('updateProfile (PUT /user/me)', () => {
    it('calls user.updateProfile with the authenticated user id and dto, returns the result', async () => {
      const dto: UpdateUserDto = { name: 'Updated Name' };
      const expected = { id: 'user-id-1', name: 'Updated Name' };
      (mockUserService.updateProfile as jest.Mock).mockResolvedValue(expected);

      const result = await controller.updateProfile(mockReq(), dto);

      expect(mockUserService.updateProfile).toHaveBeenCalledWith('user-id-1', dto);
      expect(result).toBe(expected);
    });
  });
});
