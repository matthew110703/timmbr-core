import { fakeJwt } from '@/common/testing/fake-jwt';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { RedisService } from '@/redis/redis.service';
import { TokenRevokedException } from '@/common/exceptions/token.exception';
import { TokenService } from './token.service';

const redis = {
  setWithTTL: jest.fn(),
  addToSet: jest.fn(),
  getAndDelete: jest.fn(),
  getDeleteAndMark: jest.fn(),
  get: jest.fn(),
  exists: jest.fn(),
  removeFromSet: jest.fn(),
  setMembers: jest.fn(),
  delete: jest.fn(),
};
const jwt = { signAsync: jest.fn() };
const user = { id: 'u1', email: 'a@b.co', role: UserRole.USER };
const REFRESH_TTL_S = 30 * 86400;
const REFRESH = fakeJwt(REFRESH_TTL_S);

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwt },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(TokenService);
    jwt.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce(REFRESH);
  });

  afterEach(() => jest.resetAllMocks());

  it('issues tokens with unique jtis and indexes the refresh token per user', async () => {
    await expect(service.issue(user)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: REFRESH,
    });

    const [accessOpts, refreshOpts] = jwt.signAsync.mock.calls.map((c) => c[1]);
    expect(accessOpts.jwtid).toBeDefined();
    expect(refreshOpts.jwtid).toBeDefined();
    expect(accessOpts.jwtid).not.toBe(refreshOpts.jwtid);
    expect(redis.setWithTTL).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:refresh:[0-9a-f]{64}$/),
      expect.any(Number),
      'u1',
    );
    // TTL comes from the token's own exp (JWT_REFRESH_EXPIRES_IN), not a second setting
    const ttl = redis.setWithTTL.mock.calls[0][1] as number;
    expect(ttl).toBeGreaterThanOrEqual(REFRESH_TTL_S - 2);
    expect(ttl).toBeLessThanOrEqual(REFRESH_TTL_S);
    expect(redis.addToSet).toHaveBeenCalledWith(
      'auth:refresh:user:u1',
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(Number),
    );
  });

  describe('rotate()', () => {
    const PAIR = { accessToken: 'new-at', refreshToken: 'new-rt' };

    it('consumes the old token, issues a pair and parks it for the grace window', async () => {
      redis.getDeleteAndMark.mockResolvedValue('u1');
      const issue = jest.fn().mockResolvedValue(PAIR);

      await expect(service.rotate('u1', 'old', issue)).resolves.toEqual(PAIR);
      expect(issue).toHaveBeenCalledTimes(1);
      expect(redis.getDeleteAndMark).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:refresh:[0-9a-f]{64}$/),
        expect.stringMatching(/^auth:refresh:rotating:[0-9a-f]{64}$/),
        expect.any(Number),
      );
      expect(redis.setWithTTL).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:refresh:grace:[0-9a-f]{64}$/),
        30,
        JSON.stringify({ userId: 'u1', pair: PAIR }),
      );
    });

    it('returns the same pair to a concurrent caller inside the grace window', async () => {
      redis.getDeleteAndMark.mockResolvedValue(null);
      redis.get.mockResolvedValue(JSON.stringify({ userId: 'u1', pair: PAIR }));
      const issue = jest.fn();

      await expect(service.rotate('u1', 'old', issue)).resolves.toEqual(PAIR);
      expect(issue).not.toHaveBeenCalled();
    });

    it('waits for an in-flight rotation, then returns its pair', async () => {
      redis.getDeleteAndMark.mockResolvedValue(null);
      redis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ userId: 'u1', pair: PAIR }));
      redis.exists.mockResolvedValue(true);

      await expect(service.rotate('u1', 'old', jest.fn())).resolves.toEqual(PAIR);
    });

    it('rejects reuse after the grace window (no token, no grace, not rotating)', async () => {
      redis.getDeleteAndMark.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);
      redis.exists.mockResolvedValue(false);

      await expect(service.rotate('u1', 'old', jest.fn())).rejects.toThrow(TokenRevokedException);
    });

    it("rejects another user's token, even inside the grace window", async () => {
      redis.getDeleteAndMark.mockResolvedValueOnce('someone-else').mockResolvedValueOnce(null);
      redis.get.mockResolvedValue(JSON.stringify({ userId: 'someone-else', pair: PAIR }));

      await expect(service.rotate('u1', 'old', jest.fn())).rejects.toThrow(TokenRevokedException);
      await expect(service.rotate('u1', 'old', jest.fn())).rejects.toThrow(TokenRevokedException);
    });
  });

  it('revokeAll() deletes every token the user holds', async () => {
    redis.setMembers.mockResolvedValue(['h1', 'h2']);

    await service.revokeAll('u1');

    expect(redis.delete).toHaveBeenCalledWith(
      'auth:refresh:h1',
      'auth:refresh:h2',
      'auth:refresh:user:u1',
    );
  });
});
