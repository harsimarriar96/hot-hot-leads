import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Organization } from './organization.entity';
import { Product } from './product.entity';
import { User } from './user.entity';
import { ScheduleChannel, ScheduleFrequency } from '../enums';

@Entity({ tableName: 'schedules' })
@Index({ properties: ['organization'] })
export class Schedule {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Organization, { fieldName: 'organization_id', deleteRule: 'cascade' })
  organization!: Organization;

  /** The user whose permissions the scheduled run executes with. */
  @ManyToOne(() => User, { fieldName: 'created_by_user_id', nullable: true, deleteRule: 'set null' })
  createdBy?: User;

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
