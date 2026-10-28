import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';
import { SignalSource, SignalStatus, SignalType } from '../enums';

@Entity({ tableName: 'signals' })
@Index({ properties: ['product', 'detectedAt'], name: 'signals_product_detected_at_idx' })
@Index({ properties: ['product', 'status'], name: 'signals_product_status_idx' })
export class Signal {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Product, { fieldName: 'product_id', deleteRule: 'cascade' })
  product!: Product;

  @Enum({ items: () => SignalType, nativeEnumName: 'signal_type' })
  type!: SignalType;

  @Enum({ items: () => SignalSource, nativeEnumName: 'signal_source', nullable: true })
  source?: SignalSource;

  @Property({ type: 'text' })
  description!: string;

  @Property({ type: 'text', nullable: true })
  company?: string;

  @Property({ type: 'text', nullable: true })
  sourceUrl?: string;

  @Property({ type: 'int', nullable: true })
  relevanceScore?: number;

  @Property({ type: 'timestamptz' })
  detectedAt!: Date;

  @Property({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  /** Review state; new signals wait for a human decision before they influence scoring. */
  @Enum({ items: () => SignalStatus, nativeEnumName: 'signal_status', default: SignalStatus.PENDING })
  status: SignalStatus = SignalStatus.PENDING;

  @Property({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  /** The reviewer; a plain column (like `schedules.created_by_user_id`), not a relation. */
  @Property({ type: 'uuid', nullable: true })
  reviewedByUserId?: string;

  /** Set while `status` is `snoozed`; the signal returns to the review queue once it passes. */
  @Property({ type: 'timestamptz', nullable: true })
  snoozedUntil?: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
