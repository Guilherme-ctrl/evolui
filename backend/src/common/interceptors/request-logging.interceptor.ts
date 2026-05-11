import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
    }>();
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const res = http.getResponse<{ statusCode?: number }>();
          const durationMs = Date.now() - start;
          this.logger.log(
            JSON.stringify({
              method: req.method,
              path: req.url?.split('?')[0],
              status: res.statusCode,
              durationMs,
              tenantId: req.user?.tenantId ?? null,
              userId: req.user?.sub ?? null,
            }),
          );
        },
        error: (err: { status?: number }) => {
          const durationMs = Date.now() - start;
          this.logger.warn(
            JSON.stringify({
              method: req.method,
              path: req.url?.split('?')[0],
              status: err?.status ?? 500,
              durationMs,
              tenantId: req.user?.tenantId ?? null,
              userId: req.user?.sub ?? null,
            }),
          );
        },
      }),
    );
  }
}
