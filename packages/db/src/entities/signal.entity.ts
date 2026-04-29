import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';
import { SignalSource, SignalType } from '../enums';

@Entity({ tableName: 'signals' })
@Index({ properties: ['product', 'detectedAt'], name: 'signals_product_detected_at_idx' })
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

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
