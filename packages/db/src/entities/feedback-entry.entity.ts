import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';
import { AgentType } from '../enums';

@Entity({ tableName: 'feedback_entries' })
@Index({ properties: ['product', 'createdAt'], name: 'feedback_product_created_at_idx' })
export class FeedbackEntry {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Product, { fieldName: 'product_id', deleteRule: 'cascade' })
  product!: Product;

  @Enum({ items: () => AgentType, nativeEnumName: 'agent_type' })
  agentType!: AgentType;

  @Property({ type: 'text', nullable: true })
  inputSummary?: string;

  @Property({ type: 'text', nullable: true })
  outputSummary?: string;

  @Property({ type: 'int' })
  qualityScore!: number;

  @Property({ type: 'text[]', default: '{}' })
  issues: string[] = [];

  @Property({ type: 'text[]', default: '{}' })
  suggestions: string[] = [];

  @Property({ type: 'text', nullable: true })
  overallAssessment?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
