import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';
import { SourceType } from '../enums';

@Entity({ tableName: 'product_sources' })
export class ProductSource {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Product, { fieldName: 'product_id', deleteRule: 'cascade' })
  product!: Product;

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'text', nullable: true })
  url?: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Enum({ items: () => SourceType, nativeEnumName: 'source_type', default: SourceType.OTHER })
  type: SourceType = SourceType.OTHER;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
