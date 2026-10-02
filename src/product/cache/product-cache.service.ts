import { Injectable } from '@nestjs/common';
import { env } from '@/config/env';
import { ProductResponseDto } from '../dto/product-response.dto';

interface CacheEntry {
  data: ProductResponseDto;
  expiresAt: number;
}

@Injectable()
export class ProductCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs = env.CACHE_TTL_SECONDS * 1000;

  get(key: string): ProductResponseDto | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(
    productId: string,
    slug: string,
    onlyActive: boolean,
    data: ProductResponseDto,
    ttlMs: number = this.defaultTtlMs,
  ): void {
    const expiresAt = Date.now() + ttlMs;
    const idKey = `id:${productId}:${onlyActive}`;
    const slugKey = `slug:${slug}:${onlyActive}`;

    this.cache.set(idKey, { data, expiresAt });
    this.cache.set(slugKey, { data, expiresAt });
  }

  invalidate(productId?: string, slug?: string): void {
    if (productId) {
      this.cache.delete(`id:${productId}:true`);
      this.cache.delete(`id:${productId}:false`);
    }

    if (slug) {
      this.cache.delete(`slug:${slug}:true`);
      this.cache.delete(`slug:${slug}:false`);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
