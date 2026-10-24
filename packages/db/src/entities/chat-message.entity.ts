import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import type { ChatContentBlock } from '@hothotleads/types';

import { Chat } from './chat.entity';
import { ChatRole, ChatSourceChannel } from '../enums';

export type { ChatContentBlock };

@Entity({ tableName: 'chat_messages' })
@Index({ properties: ['chat', 'createdAt'], name: 'chat_messages_chat_created_idx' })
export class ChatMessage {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Chat, { fieldName: 'chat_id', deleteRule: 'cascade' })
  chat!: Chat;

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
