import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let prisma: { isHealthy: jest.Mock };
  let redis: { isHealthy: jest.Mock };

  beforeEach(async () => {
    health = {
      check: jest.fn((checks: Array<() => unknown>) => Promise.all(checks.map((c) => c()))),
    };
    prisma = { isHealthy: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };
    redis = { isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: PrismaHealthIndicator, useValue: prisma },
        { provide: RedisHealthIndicator, useValue: redis },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('live() runs no dependency checks', async () => {
    await controller.live();
    expect(health.check).toHaveBeenCalledWith([]);
    expect(prisma.isHealthy).not.toHaveBeenCalled();
    expect(redis.isHealthy).not.toHaveBeenCalled();
  });

  it('ready() checks database and redis', async () => {
    await controller.ready();
    expect(prisma.isHealthy).toHaveBeenCalledWith('database');
    expect(redis.isHealthy).toHaveBeenCalledWith('redis');
  });
});
