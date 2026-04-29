import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';

@Entity({ tableName: 'predefined_prospects' })
export class PredefinedProspect {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Product, { fieldName: 'product_id', deleteRule: 'cascade' })
  product!: Product;

  @Property({ type: 'text' })
  company!: string;

  @Property({ type: 'text', nullable: true })
  domain?: string;

  @Property({ type: 'text', nullable: true })
  industry?: string;

  @Property({ type: 'text', nullable: true })
  companySize?: string;

  @Property({ type: 'text', nullable: true })
  fundingStage?: string;

  @Property({ type: 'text', nullable: true })
  icpFitNotes?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
