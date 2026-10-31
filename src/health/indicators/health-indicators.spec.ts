import { Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { HEALTH_CHECK_TIMEOUT_MS } from '../health.utils';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

describe('Health indicators', () => {
  const indicators = new HealthIndicatorService();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('PrismaHealthIndicator', () => {
    const make = (queryRaw: jest.Mock) =>
      new PrismaHealthIndicator({ $queryRaw: queryRaw } as unknown as PrismaService, indicators);

    it('reports up when SELECT 1 succeeds', async () => {
      const result = await make(jest.fn().mockResolvedValue([{ '?column?': 1 }])).isHealthy(
        'database',
      );
      expect(result).toEqual({ database: { status: 'up' } });
    });

    it('reports down with a generic message and does not leak the error', async () => {
      const result = await make(
        jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED db.internal:5432')),
      ).isHealthy('database');
      expect(result).toEqual({ database: { status: 'down', message: 'unavailable' } });
      expect(JSON.stringify(result)).not.toContain('db.internal');
    });

    it('reports down when the query hangs past the timeout', async () => {
      jest.useFakeTimers();
      const pending = make(jest.fn(() => new Promise(() => undefined))).isHealthy('database');
      await jest.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({
        database: { status: 'down', message: 'unavailable' },
      });
    });
  });

  describe('RedisHealthIndicator', () => {
    const make = (ping: jest.Mock) =>
      new RedisHealthIndicator({ ping } as unknown as RedisService, indicators);

    it('reports up on PONG', async () => {
      const result = await make(jest.fn().mockResolvedValue('PONG')).isHealthy('redis');
      expect(result).toEqual({ redis: { status: 'up' } });
    });

    it('reports down with a generic message when PING fails', async () => {
      const result = await make(
        jest.fn().mockRejectedValue(new Error('ECONNREFUSED redis.internal:6379')),
      ).isHealthy('redis');
      expect(result).toEqual({ redis: { status: 'down', message: 'unavailable' } });
      expect(JSON.stringify(result)).not.toContain('redis.internal');
    });

    it('reports down when PING hangs past the timeout', async () => {
      jest.useFakeTimers();
      const pending = make(jest.fn(() => new Promise(() => undefined))).isHealthy('redis');
      await jest.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({ redis: { status: 'down', message: 'unavailable' } });
    });
  });
});
