import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { OrchestratorAgent } from '../agents/orchestrator/orchestrator.agent';
import { Schedule, SchedulesRepository } from '@hothotleads/db';
import { TelegramService } from '../channels/telegram/telegram.service';
import { WhatsAppService } from '../channels/whatsapp/whatsapp.service';

const FREQUENCY_TO_CRON: Record<string, string> = {
  hourly: '0 * * * *',
  daily: '0 9 * * *',    // 9 AM daily
  weekly: '0 9 * * 1',   // 9 AM Monday
};

@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly schedulesRepo: SchedulesRepository,
    private readonly orchestrator: OrchestratorAgent,
    private readonly telegram: TelegramService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.loadSchedulesFromDatabase();
  }

  async loadSchedulesFromDatabase(): Promise<void> {
    const schedules = await this.schedulesRepo.getActiveSchedules();
    this.logger.log(`Loading ${schedules.length} schedules from database`);

    for (const schedule of schedules) {
      this.register(schedule);
    }
  }

  register(schedule: Schedule): void {
    const cronExpr =
      schedule.frequency === 'custom' && schedule.cronExpression
        ? schedule.cronExpression
        : FREQUENCY_TO_CRON[schedule.frequency] ?? '0 9 * * *';

    let job: CronJob;
    try {
      job = new CronJob(cronExpr, async () => {
        await this.runSchedule(schedule);
      });
    } catch (err) {
      this.logger.error(
        `Skipping schedule "${schedule.name}": invalid cron expression "${cronExpr}" (${(err as Error).message})`,
      );
      return;
    }

    const jobId = `schedule_${schedule.id}`;
    this.unregister(schedule.id);
    this.schedulerRegistry.addCronJob(jobId, job);
    job.start();
    this.logger.log(`Registered schedule: "${schedule.name}" (${cronExpr})`);
  }

  unregister(scheduleId: string): void {
    const jobId = `schedule_${scheduleId}`;
    try {
      this.schedulerRegistry.deleteCronJob(jobId);
      this.logger.log(`Unregistered schedule: ${scheduleId}`);
    } catch {
      // Already gone
    }
  }

  /** Fire a schedule on demand (outside its cron cadence). */
  async runOnce(schedule: Schedule): Promise<void> {
    await this.runSchedule(schedule);
  }

  private async runSchedule(schedule: Schedule): Promise<void> {
    this.logger.log(`Firing schedule: "${schedule.name}"`);

    try {
      const productName = schedule.product?.name;
      const response = await this.orchestrator.run(schedule.taskPrompt, {
        extraContext: `Scheduled task. User: ${schedule.userId}, Channel: ${schedule.channel}, Product: ${productName ?? 'unspecified'}`,
      });

      await this.deliver(schedule.channel, schedule.chatId, response);
      await this.schedulesRepo.markLastRun(schedule.id);
    } catch (err) {
      this.logger.error(`Schedule "${schedule.name}" failed: ${(err as Error).message}`);
      try {
        await this.deliver(
          schedule.channel,
          schedule.chatId,
          `⚠️ Scheduled task *${schedule.name}* failed. Please check the logs.`,
        );
      } catch (deliverErr) {
        this.logger.error(`Could not deliver failure notice: ${(deliverErr as Error).message}`);
      }
    }
  }

  private async deliver(channel: string, chatId: string, text: string): Promise<void> {
    const message = { chatId, text };
    if (channel === 'telegram') {
      await this.telegram.send(message);
    } else if (channel === 'whatsapp') {
      await this.whatsapp.send(message);
    }
  }
}
