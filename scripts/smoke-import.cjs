// Loads the compiled app module graph (every controller, service and DTO) without
// connecting to anything. SWC builds don't type-check, so this catches runtime
// import failures, e.g. a stale Prisma client missing a newly added enum.
const dummy = {
  DATABASE_URL: 'postgresql://ci:ci@localhost:5432/ci',
  JWT_ACCESS_SECRET: 'x',
  JWT_REFRESH_SECRET: 'x',
  COOKIE_SECRET: 'x',
  REDIS_URL: 'redis://localhost:6379',
  RESEND_API_KEY: 'x',
  MAIL_FROM: 'x@example.com',
  GOOGLE_CLIENT_ID: 'x',
  GOOGLE_CLIENT_SECRET: 'x',
  GOOGLE_CALLBACK_URL: 'http://localhost/cb',
};
for (const [key, value] of Object.entries(dummy)) process.env[key] ??= value;

require('reflect-metadata');
require('../dist/app.module');
console.log('smoke-import: app module graph loaded');
