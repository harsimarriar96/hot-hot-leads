import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';

import { Public } from './modules/auth/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly em: EntityManager) {}

  @Get()
  async check(): Promise<{ status: string; db: string; timestamp: string }> {
    const timestamp = new Date().toISOString();
    try {
      await this.em.getConnection().execute('select 1');
      return { status: 'ok', db: 'up', timestamp };
    } catch (err) {
      this.logger.error(`Health check: database unreachable (${(err as Error).message})`);
      throw new HttpException(
        { status: 'degraded', db: 'down', timestamp },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
