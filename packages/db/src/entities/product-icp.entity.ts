import { Entity, OneToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';

@Entity({ tableName: 'product_icp' })
export class ProductIcp {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @OneToOne(() => Product, (p) => p.icp, { owner: true, fieldName: 'product_id', unique: true, deleteRule: 'cascade' })
  product!: Product;

  @Property({ type: 'text[]', default: '{}' })
  targetIndustries: string[] = [];

  @Property({ type: 'text[]', default: '{}' })
  companySizes: string[] = [];

  @Property({ type: 'text[]', default: '{}' })
  fundingStages: string[] = [];

  @Property({ type: 'text[]', default: '{}' })
  geographies: string[] = [];

  @Property({ type: 'jsonb', nullable: true })
  buyerPersonas?: Record<string, unknown>;

  @Property({ type: 'text', nullable: true })
  notes?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
