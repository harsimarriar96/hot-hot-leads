import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';
import { ScheduleChannel, ScheduleFrequency } from '../enums';

@Entity({ tableName: 'schedules' })
export class Schedule {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Product, { fieldName: 'product_id', nullable: true, deleteRule: 'set null' })
  product?: Product;

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'text' })
  taskPrompt!: string;

  @Enum({ items: () => ScheduleFrequency, nativeEnumName: 'schedule_frequency' })
  frequency!: ScheduleFrequency;

  @Property({ type: 'text', nullable: true })
  cronExpression?: string;

  @Property({ type: 'text' })
  userId!: string;

  @Property({ type: 'text' })
  chatId!: string;

  @Enum({ items: () => ScheduleChannel, nativeEnumName: 'schedule_channel' })
  channel!: ScheduleChannel;

  @Property({ type: 'jsonb', nullable: true })
  taskPayload?: Record<string, unknown>;

  @Property({ type: 'boolean', default: true })
  enabled: boolean = true;

  @Property({ type: 'timestamptz', nullable: true })
  lastRunAt?: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
