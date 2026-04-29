import {
  Collection,
  Entity,
  Enum,
  OneToMany,
  OneToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { AgentModelTier } from '../enums';
import { ProductIcp } from './product-icp.entity';
import { ProductSalesChannel } from './product-sales-channel.entity';
import { ProductSource } from './product-source.entity';
import { PredefinedProspect } from './predefined-prospect.entity';
import { Lead } from './lead.entity';
import { Signal } from './signal.entity';
import { Schedule } from './schedule.entity';
import { FeedbackEntry } from './feedback-entry.entity';

@Entity({ tableName: 'products' })
export class Product {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  @Unique()
  name!: string;

  @Property({ type: 'text' })
  @Unique()
  slug!: string;

  @Property({ type: 'text', nullable: true })
  generalInfo?: string;

  @Property({ type: 'text', nullable: true })
  salesStrategy?: string;

  @Property({ type: 'text', nullable: true })
  pricing?: string;

  @Enum({
    items: () => AgentModelTier,
    nativeEnumName: 'agent_model_tier',
    default: AgentModelTier.DEFAULT,
  })
  agentModelTier: AgentModelTier = AgentModelTier.DEFAULT;

  @Property({ type: 'text', nullable: true })
  agentExtraInstructions?: string;

  /** ICP scoring strictness, 0–100. Higher = score lower for adjacent fits. */
  @Property({ type: 'int', default: 60 })
  icpStrictness: number = 60;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToOne(() => ProductIcp, (icp) => icp.product, { orphanRemoval: true, nullable: true })
  icp?: ProductIcp;

  @OneToMany(() => ProductSalesChannel, (c) => c.product, { orphanRemoval: true })
  salesChannels = new Collection<ProductSalesChannel>(this);

  @OneToMany(() => ProductSource, (s) => s.product, { orphanRemoval: true })
  sources = new Collection<ProductSource>(this);

  @OneToMany(() => PredefinedProspect, (p) => p.product, { orphanRemoval: true })
  predefinedProspects = new Collection<PredefinedProspect>(this);

  @OneToMany(() => Lead, (lead) => lead.product, { orphanRemoval: true })
  leads = new Collection<Lead>(this);

  @OneToMany(() => Signal, (s) => s.product, { orphanRemoval: true })
  signals = new Collection<Signal>(this);

  @OneToMany(() => Schedule, (s) => s.product)
  schedules = new Collection<Schedule>(this);

  @OneToMany(() => FeedbackEntry, (f) => f.product, { orphanRemoval: true })
  feedbackEntries = new Collection<FeedbackEntry>(this);
}
