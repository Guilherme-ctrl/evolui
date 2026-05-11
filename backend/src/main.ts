import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const defaultOrigins =
    'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174';
  const raw = config.get<string>('CORS_ORIGIN');
  const source = raw?.trim() ? raw : defaultOrigins;
  const origins = source
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin =
    origins.length === 0
      ? defaultOrigins.split(',').map((s) => s.trim())
      : origins.length === 1
        ? origins[0]
        : origins;
  app.enableCors({ origin, credentials: true });
  const port = config.get<number>('PORT') ?? 3333;

  app.getHttpAdapter().get('/', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'api',
      apiBase: '/api',
    });
  });

  await app.listen(port);
}
bootstrap();
