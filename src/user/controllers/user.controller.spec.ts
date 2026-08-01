import { Test, TestingModule } from '@nestjs/testing';
import { FastifyRequest } from 'fastify';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { UpdateUserDto } from '../dto/update-user.dto';

const USER_ID = '11111111-1111-1111-1111-111111111111';

const mockUserService = {
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
};

const mockRequest = {
  user: { sub: USER_ID },
} as unknown as FastifyRequest;

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('delegates to service.getProfile', async () => {
      const profile = { id: USER_ID, name: 'John' };
      mockUserService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile(mockRequest);

      expect(mockUserService.getProfile).toHaveBeenCalledWith(USER_ID);
      expect(result).toBe(profile);
    });
  });

  describe('updateProfile', () => {
    it('delegates to service.updateProfile', async () => {
      const dto: UpdateUserDto = { name: 'John Updated' };
      const updated = { id: USER_ID, name: 'John Updated' };
      mockUserService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile(mockRequest, dto);

      expect(mockUserService.updateProfile).toHaveBeenCalledWith(USER_ID, dto);
      expect(result).toBe(updated);
    });
  });
});
