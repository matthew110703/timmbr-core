import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from './app.config';

@Global()
@Module({
  providers: [{ provide: 'APP_CONFIG', useValue: APP_CONFIG }],
  exports: ['APP_CONFIG'],
})
export class AppConfigModule {}
