import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { ProductChat } from './product-chat.entity';
import { ChatRole, ChatSourceChannel } from '../enums';

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string | Record<string, unknown>;
      is_error?: boolean;
    };

@Entity({ tableName: 'product_chat_messages' })
@Index({ properties: ['chat', 'createdAt'], name: 'product_chat_messages_chat_created_idx' })
export class ProductChatMessage {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => ProductChat, { fieldName: 'chat_id', deleteRule: 'cascade' })
  chat!: ProductChat;

  @Enum({ items: () => ChatRole, nativeEnumName: 'chat_role' })
  role!: ChatRole;

  @Property({ type: 'jsonb' })
  contentBlocks!: ChatContentBlock[];

  @Enum({ items: () => ChatSourceChannel, nativeEnumName: 'chat_source_channel', default: ChatSourceChannel.WEB })
  sourceChannel: ChatSourceChannel = ChatSourceChannel.WEB;

  @Property({ type: 'text', nullable: true })
  sourceRef?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
