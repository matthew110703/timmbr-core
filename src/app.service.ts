import { Injectable } from '@nestjs/common';
import { APP_CONFIG } from '@/config/app.config';

@Injectable()
export class AppService {
  getHello(): string {
    return APP_CONFIG.name;
  }
}
