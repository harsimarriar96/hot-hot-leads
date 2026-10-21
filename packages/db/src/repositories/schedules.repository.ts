import { EntityManager } from '@mikro-orm/postgresql';

import { Organization } from '../entities/organization.entity';
import { Product } from '../entities/product.entity';
import { Schedule } from '../entities/schedule.entity';
import { User } from '../entities/user.entity';
import { ScheduleChannel, ScheduleFrequency } from '../enums';

export interface SaveScheduleInput {
  name: string;
  taskPrompt: string;
  frequency: ScheduleFrequency | string;
  /** Channel-side sender reference (Telegram user id / WhatsApp number). */
  userId: string;
  chatId: string;
  channel: ScheduleChannel | string;
  /** The app user whose permissions the schedule runs with. */
  createdByUserId?: string;
  productName?: string;
  cronExpression?: string;
  taskPayload?: Record<string, unknown>;
}

const SCHEDULE_POPULATE = ['product', 'organization', 'createdBy'] as const;

export class SchedulesRepository {
  constructor(private readonly em: EntityManager) {}

  async saveSchedule(orgId: string, input: SaveScheduleInput): Promise<{ id: string; name: string }> {
    const em = this.em.fork();

    let product: Product | undefined;
    if (input.productName) {
      const found = await em.findOne(Product, { organization: orgId, name: input.productName });
      if (!found) throw new Error(`Product "${input.productName}" not found in this organization`);
      product = found;
    }

    const createdBy = input.createdByUserId
      ? (await em.findOne(User, { id: input.createdByUserId })) ?? undefined
      : undefined;

    const schedule = em.create(
      Schedule,
      {
        organization: em.getReference(Organization, orgId),
        createdBy,
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

  /** Every enabled schedule across all organizations: the in-process cron registry is global. */
  async getActiveSchedules(): Promise<Schedule[]> {
    return this.em.fork().find(Schedule, { enabled: true }, { populate: [...SCHEDULE_POPULATE] });
  }

  async listForOrg(orgId: string): Promise<Schedule[]> {
    return this.em.fork().find(
      Schedule,
      { organization: orgId },
      { populate: [...SCHEDULE_POPULATE], orderBy: { createdAt: 'DESC' } },
    );
  }

  async findForOrg(orgId: string, id: string): Promise<Schedule | null> {
    return this.em
      .fork()
      .findOne(Schedule, { id, organization: orgId }, { populate: [...SCHEDULE_POPULATE] });
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const em = this.em.fork();
    const schedule = await em.findOne(Schedule, { id });
    if (!schedule) return;
    schedule.enabled = enabled;
    await em.flush();
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
