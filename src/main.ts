import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Telegram webhook signature verification
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`HotHotLeads running on http://${host}:${port}`);
  logger.log(`Health: http://${host}:${port}/health`);
}

bootstrap();
