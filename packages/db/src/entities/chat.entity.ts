import {
  Collection,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Organization } from './organization.entity';
import { Product } from './product.entity';
import { User } from './user.entity';
import { ChatMessage } from './chat-message.entity';

/**
 * A conversation. Organization-scoped and optionally linked to a product; the
 * product's legacy single thread was migrated into its first conversation.
 */
@Entity({ tableName: 'chats' })
@Index({ name: 'chats_organization_last_message_idx', properties: ['organization', 'lastMessageAt'] })
@Index({ name: 'chats_product_last_message_idx', properties: ['product', 'lastMessageAt'] })
export class Chat {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Organization, { fieldName: 'organization_id', deleteRule: 'cascade' })
  organization!: Organization;

  @ManyToOne(() => Product, { fieldName: 'product_id', nullable: true, deleteRule: 'cascade' })
  product?: Product;

  @ManyToOne(() => User, { fieldName: 'created_by_user_id', nullable: true, deleteRule: 'set null' })
  createdBy?: User;

  @Property({ type: 'text', nullable: true })
  title?: string;

  /** Bumped on every appended message so lists sort by activity without a join. */
  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  lastMessageAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => ChatMessage, (m) => m.chat, { orphanRemoval: true })
  messages = new Collection<ChatMessage>(this);
}
