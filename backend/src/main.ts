import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const raw =
    config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fallback = 'http://localhost:5173';
  const origin =
    origins.length === 0
      ? fallback
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
