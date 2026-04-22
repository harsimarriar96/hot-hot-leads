import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { OrchestratorAgent } from '../agents/orchestrator/orchestrator.agent';
import { SchedulesRepository } from '../integrations/notion/repositories/schedules.repository';
import { TelegramService } from '../channels/telegram/telegram.service';
import { WhatsAppService } from '../channels/whatsapp/whatsapp.service';
import { Schedule } from '../common/types';

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
    await this.loadSchedulesFromNotion();
  }

  async loadSchedulesFromNotion(): Promise<void> {
    const schedules = await this.schedulesRepo.getActiveSchedules();
    this.logger.log(`Loading ${schedules.length} schedules from Notion`);

    for (const schedule of schedules) {
      this.register(schedule);
    }
  }

  register(schedule: Schedule): void {
    const cronExpr =
      schedule.frequency === 'custom' && schedule.cronExpression
        ? schedule.cronExpression
        : FREQUENCY_TO_CRON[schedule.frequency] ?? '0 9 * * *';

    const job = new CronJob(cronExpr, async () => {
      await this.runSchedule(schedule);
    });

    const jobId = `schedule_${schedule.id}`;
    try {
      this.schedulerRegistry.addCronJob(jobId, job);
      job.start();
      this.logger.log(`Registered schedule: "${schedule.name}" (${cronExpr})`);
    } catch {
      // Job already registered — replace it
      this.schedulerRegistry.deleteCronJob(jobId);
      this.schedulerRegistry.addCronJob(jobId, job);
      job.start();
    }
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

  private async runSchedule(schedule: Schedule): Promise<void> {
    this.logger.log(`Firing schedule: "${schedule.name}"`);

    try {
      const response = await this.orchestrator.run(schedule.taskPrompt, {
        extraContext: `Scheduled task. User: ${schedule.userId}, Channel: ${schedule.channel}, Product: ${schedule.productName ?? 'unspecified'}`,
      });

      await this.deliver(schedule.channel, schedule.chatId, response);

      if (schedule.notionPageId) {
        await this.schedulesRepo.markLastRun(schedule.notionPageId);
      }
    } catch (err) {
      this.logger.error(`Schedule "${schedule.name}" failed:`, err);
      await this.deliver(
        schedule.channel,
        schedule.chatId,
        `⚠️ Scheduled task *${schedule.name}* failed. Please check the logs.`,
      );
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
