import { fakeJwt } from '@/common/testing/fake-jwt';
import { secondsUntilJwtExpiry } from './jwt-expiry.util';

describe('secondsUntilJwtExpiry', () => {
  it("reads the lifetime from the token's own exp", () => {
    expect(secondsUntilJwtExpiry(fakeJwt(30 * 86400))).toBeGreaterThanOrEqual(30 * 86400 - 1);
  });

  it('never returns less than 1 second', () => {
    expect(secondsUntilJwtExpiry(fakeJwt(-60))).toBe(1);
  });

  it('rejects tokens without exp', () => {
    expect(() => secondsUntilJwtExpiry('not.a.jwt')).toThrow();
  });
});
