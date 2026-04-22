export type ChannelType = 'telegram' | 'whatsapp';

export interface IncomingMessage {
  channel: ChannelType;
  userId: string;
  chatId: string;
  text: string;
  timestamp: Date;
  rawPayload?: Record<string, unknown>;
}

export interface OutgoingMessage {
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  replyToMessageId?: string;
}
