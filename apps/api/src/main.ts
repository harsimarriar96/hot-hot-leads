import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

function logLevels(level: string | undefined): LogLevel[] {
  switch ((level ?? 'info').toLowerCase()) {
    case 'debug':
    case 'verbose':
      return ['error', 'warn', 'log', 'debug', 'verbose'];
    case 'warn':
      return ['error', 'warn'];
    case 'error':
      return ['error'];
    default:
      return ['error', 'warn', 'log'];
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Webhook signature verification needs the unparsed body.
    logger: logLevels(process.env.LOG_LEVEL),
  });

  // Behind Caddy / an ALB the client IP arrives in X-Forwarded-For.
  app.set('trust proxy', 1);

  // Every HTTP API route lives under /api so the SPA owns every other path.
  // Health and the externally-configured webhooks stay at their root paths.
  app.setGlobalPrefix('api', { exclude: ['health', 'webhooks/(.*)'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`HotHotLeads running on http://${host}:${port}`);
  logger.log(`Health: http://${host}:${port}/health`);
}

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
  new Logger('Process').error(`Unhandled promise rejection: ${message}`);
});

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
