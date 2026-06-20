import type { Logger } from 'nestjs-pino';

declare global {
  var logger: Logger;
}
