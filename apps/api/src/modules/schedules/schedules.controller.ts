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
import { Schedule, SchedulesRepository } from '@hothotleads/db';
import { CronTime } from 'cron';

import { SchedulerService } from '../../scheduler/scheduler.service';
import { Auth } from '../auth/auth.decorator';
import { RequireFeature, RequirePermission } from '../auth/access.decorators';
import { requireOrg, type TenantContext } from '../auth/tenant-context';

interface UpdateScheduleDto {
  enabled?: boolean;
}

@Controller('schedules')
@RequireFeature('schedules')
export class SchedulesController {
  private readonly logger = new Logger(SchedulesController.name);

  constructor(
    private readonly schedulesRepo: SchedulesRepository,
    private readonly scheduler: SchedulerService,
  ) {}

  @Get()
  @RequirePermission('schedules:read')
  async list(@Auth() auth: TenantContext) {
    const { org } = requireOrg(auth);
    const schedules = await this.schedulesRepo.listForOrg(org.id);
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
  @RequirePermission('schedules:write')
  async update(@Auth() auth: TenantContext, @Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    const { org } = requireOrg(auth);
    const schedule = await this.schedulesRepo.findForOrg(org.id, id);
    if (!schedule) throw new NotFoundException('Schedule not found');

    if (dto.enabled !== undefined && dto.enabled !== schedule.enabled) {
      schedule.enabled = dto.enabled;
      await this.schedulesRepo.setEnabled(schedule.id, dto.enabled);
      if (dto.enabled) {
        this.scheduler.register(schedule);
      } else {
        this.scheduler.unregister(schedule.id);
      }
    }
    return { id: schedule.id, enabled: schedule.enabled };
  }

  @Post(':id/run')
  @RequirePermission('schedules:write')
  @HttpCode(202)
  async runNow(@Auth() auth: TenantContext, @Param('id') id: string) {
    const { org } = requireOrg(auth);
    const schedule = await this.schedulesRepo.findForOrg(org.id, id);
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
