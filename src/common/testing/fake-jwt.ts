/** Unsigned JWT-shaped string with an `exp` this many seconds from now (tests only). */
export function fakeJwt(expiresInS: number, claims: Record<string, unknown> = {}): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInS;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', ...claims, exp })}.sig`;
}
