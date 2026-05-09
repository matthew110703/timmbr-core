import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Imports
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
import { GlobalExceptionFilter } from './common/filters';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule, PrismaModule, LoggerModule, HealthModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: GlobalExceptionFilter }],
})
export class AppModule {}
