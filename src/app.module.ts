import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Imports
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [AppConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
