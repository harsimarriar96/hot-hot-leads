import { Collection, Entity, OneToMany, OneToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';
import { ProductChatMessage } from './product-chat-message.entity';

@Entity({ tableName: 'product_chats' })
export class ProductChat {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @OneToOne(() => Product, { owner: true, fieldName: 'product_id', unique: true, deleteRule: 'cascade' })
  product!: Product;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => ProductChatMessage, (m) => m.chat, { orphanRemoval: true })
  messages = new Collection<ProductChatMessage>(this);
}
