import { EntityManager } from '@mikro-orm/postgresql';

import { Schedule } from '../entities/schedule.entity';
import { Product } from '../entities/product.entity';
import { ScheduleChannel, ScheduleFrequency } from '../enums';

export interface SaveScheduleInput {
  name: string;
  taskPrompt: string;
  frequency: ScheduleFrequency | string;
  userId: string;
  chatId: string;
  channel: ScheduleChannel | string;
  productName?: string;
  cronExpression?: string;
  taskPayload?: Record<string, unknown>;
}

export class SchedulesRepository {
  constructor(private readonly em: EntityManager) {}

  /** Kept for API compat — always true now that Postgres replaces Notion. */
  isConfigured(): boolean {
    return true;
  }

  async saveSchedule(input: SaveScheduleInput): Promise<{ id: string; name: string }> {
    const em = this.em.fork();

    let product: Product | undefined;
    if (input.productName) {
      const found = await em.findOne(Product, { name: input.productName });
      if (!found) throw new Error(`Product "${input.productName}" not found`);
      product = found;
    }

    const schedule = em.create(
      Schedule,
      {
        name: input.name,
        taskPrompt: input.taskPrompt,
        frequency: input.frequency as ScheduleFrequency,
        channel: input.channel as ScheduleChannel,
        userId: input.userId,
        chatId: input.chatId,
        cronExpression: input.cronExpression,
        taskPayload: input.taskPayload,
        product,
      },
      { partial: true },
    );

    await em.persistAndFlush(schedule);
    return { id: schedule.id, name: schedule.name };
  }

  async getActiveSchedules(): Promise<Schedule[]> {
    return this.em.find(Schedule, { enabled: true }, { populate: ['product'] });
  }

  /** Alias for getActiveSchedules to match the spec's naming. */
  async listEnabled(): Promise<Schedule[]> {
    return this.getActiveSchedules();
  }

  async markLastRun(id: string): Promise<void> {
    const em = this.em.fork();
    const schedule = await em.findOne(Schedule, { id });
    if (!schedule) return;
    schedule.lastRunAt = new Date();
    await em.flush();
  }

  async disableSchedule(id: string): Promise<void> {
    const em = this.em.fork();
    const schedule = await em.findOne(Schedule, { id });
    if (!schedule) return;
    schedule.enabled = false;
    await em.flush();
  }
}
