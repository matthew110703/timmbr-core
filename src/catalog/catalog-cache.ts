import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';

/**
 * Read-through cache for the storefront catalog reads (listing, facets, suggestions, product
 * pages): Redis first, then ONE shared computation per key in this process (concurrent misses
 * wait for the same promise), then store. Redis being down only costs the cache, never the
 * request.
 */
@Injectable()
export class CatalogCache {
  private readonly logger = new Logger(CatalogCache.name);
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const running = this.inflight.get(key) as Promise<T> | undefined;
    if (running) return running;

    const hit = await this.redis.getJson<T>(key).catch((error: unknown) => {
      this.logger.warn(`Catalog cache read failed: ${String(error)}`);
      return null;
    });
    if (hit) return hit;

    return (
      (this.inflight.get(key) as Promise<T> | undefined) ??
      this.computeAndStore(key, ttlSeconds, compute)
    );
  }

  private computeAndStore<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    const pending = compute()
      .then(async (value) => {
        await this.redis
          .setJson(key, ttlSeconds, value)
          .catch((error: unknown) =>
            this.logger.warn(`Catalog cache write failed: ${String(error)}`),
          );
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, pending);
    return pending;
  }
}
