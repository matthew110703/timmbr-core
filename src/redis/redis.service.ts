import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

/** INCR + first-time EXPIRE in one step, so a crash can't leave a key without TTL. */
const INCR_WITH_EXPIRY = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`;

/** Delete the key only if it holds the expected value. -1 missing, 0 mismatch, 1 consumed. */
const CONSUME_IF_EQUALS = `
local current = redis.call('GET', KEYS[1])
if not current then return -1 end
if current ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1`;

/** GETDEL + SET marker EX in one step. Returns the deleted value (or nil). */
const GETDEL_AND_MARK = `
local value = redis.call('GET', KEYS[1])
if not value then return false end
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[2], '1', 'EX', ARGV[1])
return value`;

export type ConsumeResult = 'consumed' | 'mismatch' | 'missing';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  setWithTTL(key: string, ttlSeconds: number, value: string) {
    return this.client.setex(key, ttlSeconds, value);
  }

  /** SET NX EX — true when the key was created (i.e. didn't already exist). */
  async setIfAbsent(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    return (await this.client.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
  }

  get(key: string) {
    return this.client.get(key);
  }

  getAndDelete(key: string) {
    return this.client.getdel(key);
  }

  delete(...keys: string[]) {
    return keys.length ? this.client.del(...keys) : Promise.resolve(0);
  }

  /** Remaining TTL in seconds (0 when the key is missing or has no expiry). */
  async ttl(key: string): Promise<number> {
    return Math.max(0, await this.client.ttl(key));
  }

  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    return Number(await this.client.eval(INCR_WITH_EXPIRY, 1, key, ttlSeconds));
  }

  /**
   * Atomically delete `key` and set `markerKey` (TTL) if `key` existed.
   * Returns the deleted value, or null if it was already gone.
   */
  async getDeleteAndMark(
    key: string,
    markerKey: string,
    markerTtlSeconds: number,
  ): Promise<string | null> {
    const result = await this.client.eval(GETDEL_AND_MARK, 2, key, markerKey, markerTtlSeconds);
    return typeof result === 'string' ? result : null;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async consumeIfEquals(key: string, expected: string): Promise<ConsumeResult> {
    const result = Number(await this.client.eval(CONSUME_IF_EQUALS, 1, key, expected));
    return result === 1 ? 'consumed' : result === 0 ? 'mismatch' : 'missing';
  }

  /** Add a member and (re)extend the set's TTL. */
  async addToSet(key: string, member: string, ttlSeconds: number) {
    await this.client.multi().sadd(key, member).expire(key, ttlSeconds).exec();
  }

  removeFromSet(key: string, member: string) {
    return this.client.srem(key, member);
  }

  setMembers(key: string) {
    return this.client.smembers(key);
  }
}
