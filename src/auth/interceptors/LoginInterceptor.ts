import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Observable, switchMap } from 'rxjs';
import { LoginResponseDto } from '../dto/login-dto';

@Injectable()
export class LoginIntercepter implements NestInterceptor {
  constructor(private readonly auth: AuthService) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(
      switchMap(async ({ data }: { data: LoginResponseDto }) => {
        if (data.id) {
          await this.auth.updateLastLoginAt(data.id);
        }
        return data;
      }),
    );
  }
}
