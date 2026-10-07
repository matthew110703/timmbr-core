import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import { env } from '@/config/env';
import { RedisService } from '@/redis/redis.service';
import { User } from '@/common/types/user';
import { TokenRevokedException } from '@/common/exceptions/token.exception';
import { JwtPayload } from '../types/jwt.types';
import { REFRESH_GRACE_S } from '../auth.constants';
import { secondsUntilJwtExpiry } from '../utils/jwt-expiry.util';

/** How long a rotation may take before concurrent callers stop waiting for it. */
const ROTATING_MARKER_TTL_S = 10;
const GRACE_WAIT_MS = 3000;
const GRACE_POLL_MS = 50;

interface GraceRecord {
  userId: string;
  pair: TokenPair;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues, rotates and revokes JWTs. Refresh tokens are stored hashed
 * (`auth:refresh:{sha256}` → userId) and indexed per user
 * (`auth:refresh:user:{id}`) so every session can be revoked at once.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  /** Sign a new pair and register the refresh token. */
  async issue(user: Pick<User, 'id' | 'email' | 'role'>): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    // A unique `jti` keeps two tokens issued in the same second distinct.
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
        jwtid: crypto.randomUUID(),
      }),
      this.jwt.signAsync(payload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
        jwtid: crypto.randomUUID(),
      }),
    ]);

    // Stored exactly as long as the token is valid (JWT_REFRESH_EXPIRES_IN).
    const ttl = secondsUntilJwtExpiry(refreshToken);
    const hash = this.hash(refreshToken);
    await this.redis.setWithTTL(this.tokenKey(hash), ttl, user.id);
    await this.redis.addToSet(this.userKey(user.id), hash, ttl);

    return { accessToken, refreshToken };
  }

  /**
   * Single-use rotation with a short grace window.
   *
   * The first caller consumes the old token and gets a fresh pair from `issue`.
   * Concurrent callers presenting the *same* old token within REFRESH_GRACE_S
   * (parallel requests on one page load, or the shell and a zone proxy both
   * refreshing) receive that same pair instead of TOKEN_REVOKED. Any use after
   * the window — e.g. a stolen, replayed token — is rejected.
   */
  async rotate(
    userId: string,
    rawRefreshToken: string,
    issue: () => Promise<TokenPair>,
  ): Promise<TokenPair> {
    const hash = this.hash(rawRefreshToken);
    const graceKey = this.graceKey(hash);

    // Consume + mark "rotating" atomically, so a concurrent caller that misses
    // the token knows a fresh pair is on its way.
    const storedUserId = await this.redis.getDeleteAndMark(
      this.tokenKey(hash),
      this.rotatingKey(hash),
      ROTATING_MARKER_TTL_S,
    );

    if (storedUserId) {
      await this.redis.removeFromSet(this.userKey(storedUserId), hash);
      if (storedUserId !== userId) throw new TokenRevokedException();

      const pair = await issue();
      await this.redis.setWithTTL(graceKey, REFRESH_GRACE_S, JSON.stringify({ userId, pair }));
      return pair;
    }

    const grace = await this.waitForGrace(hash);
    if (!grace || grace.userId !== userId) throw new TokenRevokedException();
    return grace.pair;
  }

  /** Grace pair for a just-rotated token; waits briefly if rotation is in flight. */
  private async waitForGrace(hash: string): Promise<GraceRecord | null> {
    const deadline = Date.now() + GRACE_WAIT_MS;
    for (;;) {
      const raw = await this.redis.get(this.graceKey(hash));
      if (raw) return JSON.parse(raw) as GraceRecord;
      if (Date.now() >= deadline || !(await this.redis.exists(this.rotatingKey(hash)))) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, GRACE_POLL_MS));
    }
  }

  async revoke(rawRefreshToken: string): Promise<void> {
    const hash = this.hash(rawRefreshToken);
    const userId = await this.redis.getAndDelete(this.tokenKey(hash));
    if (userId) await this.redis.removeFromSet(this.userKey(userId), hash);
  }

  /** Revoke every refresh token the user holds (log out everywhere). */
  async revokeAll(userId: string): Promise<void> {
    const hashes = await this.redis.setMembers(this.userKey(userId));
    await this.redis.delete(...hashes.map((h) => this.tokenKey(h)), this.userKey(userId));
  }

  private hash(rawToken: string) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private tokenKey(hash: string) {
    return `auth:refresh:${hash}`;
  }

  private graceKey(hash: string) {
    return `auth:refresh:grace:${hash}`;
  }

  private rotatingKey(hash: string) {
    return `auth:refresh:rotating:${hash}`;
  }

  private userKey(userId: string) {
    return `auth:refresh:user:${userId}`;
  }
}
