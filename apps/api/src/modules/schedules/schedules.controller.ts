import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Schedule } from '@hothotleads/db';
import { CronTime } from 'cron';

import { SchedulerService } from '../../scheduler/scheduler.service';

interface UpdateScheduleDto {
  enabled?: boolean;
}

@Controller('api/schedules')
export class SchedulesController {
  private readonly logger = new Logger(SchedulesController.name);

  constructor(
    private readonly em: EntityManager,
    private readonly scheduler: SchedulerService,
  ) {}

  @Get()
  async list() {
    const schedules = await this.em.find(
      Schedule,
      {},
      { populate: ['product'], orderBy: { createdAt: 'DESC' } },
    );
    return schedules.map((s) => ({
      id: s.id,
      name: s.name,
      taskPrompt: s.taskPrompt,
      frequency: s.frequency,
      cronExpression: s.cronExpression ?? null,
      channel: s.channel,
      chatId: s.chatId,
      userId: s.userId,
      enabled: s.enabled,
      lastRunAt: s.lastRunAt ?? null,
      nextRunAt: this.computeNextRunAt(s),
      productName: s.product?.name ?? null,
      productId: s.product?.id ?? null,
      createdAt: s.createdAt,
    }));
  }

  private computeNextRunAt(schedule: Schedule): string | null {
    if (!schedule.enabled || !schedule.cronExpression) return null;
    try {
      return new CronTime(schedule.cronExpression).sendAt().toJSDate().toISOString();
    } catch (err) {
      this.logger.warn(
        `Invalid cron "${schedule.cronExpression}" on schedule ${schedule.id}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    const em = this.em.fork();
    const schedule = await em.findOne(Schedule, { id });
    if (!schedule) throw new NotFoundException('Schedule not found');

    if (dto.enabled !== undefined && dto.enabled !== schedule.enabled) {
      schedule.enabled = dto.enabled;
      await em.flush();
      if (dto.enabled) {
        this.scheduler.register(schedule);
      } else {
        this.scheduler.unregister(schedule.id);
      }
    }
    return { id: schedule.id, enabled: schedule.enabled };
  }

  @Post(':id/run')
  @HttpCode(202)
  async runNow(@Param('id') id: string) {
    const schedule = await this.em.findOne(Schedule, { id }, { populate: ['product'] });
    if (!schedule) throw new NotFoundException('Schedule not found');
    // Fire-and-forget so the HTTP request returns immediately; the actual run
    // continues server-side.
    this.scheduler.runOnce(schedule).catch((err) => {
      // Errors are logged by runSchedule itself; nothing more to do here.
      void err;
    });
    return { id: schedule.id, status: 'queued' };
  }
}
